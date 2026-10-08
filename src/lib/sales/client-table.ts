// The Client table: one row per product a client bought, grouped by invoice. Server-side only.
// Built from the INVOICES of the workspace (so every client with an issued invoice shows, whether the invoice came from a
// pipeline card or was made by Accounting directly), joined with the pipeline card (paid / approved date) and the project (start).
// Used by Sales > Client, Optimizing > Clients (with handler assignment) and mirrored in Advertiser / Admin (up to Product).
import { computeProjectTerms, type RequestItem } from '@/lib/sales/flow';

type Db = any;

export interface ClientRow {
  key: string;
  invoiceId: string;
  dealId: string | null;
  clientId: string;
  clientName: string;
  brand: string;
  store: string;
  product: string;
  quantity: number;
  /** ISO time the invoice was paid (or Accounting approved the deal without payment). */
  paidAt: string | null;
  accApprovedOnly: boolean;
  start: string | null;
  /** End date from this product's length, or a deliverable text such as "30 videos". */
  end: string | null;
  endText: string | null;
  invoiceNumber: string | null;
  status: string | null;
  /** The project may start: the invoice is paid, or the deal was approved. */
  isDeal: boolean;
  advertiserId: string | null;
  adminId: string | null;
  groupSize: number;
  groupIndex: number;
}

const HIDDEN_STATUS = ['draft', 'void', 'cancelled', 'canceled'];
const NO_LINES: RequestItem = { product_id: null, name: '(no product lines)', quantity: 1, unit_price: 0, scale: null, duration_type: 'none', duration_value: 0, deliverable_unit: null };

export async function loadClientRows(
  db: Db,
  workspaceId: string,
  opts: { salesmanId?: string; clientIds?: Set<string>; maskName: (name: string | null | undefined, assignedWorkspaceId?: string | null) => string }
): Promise<ClientRow[]> {
  let q = db
    .from('invoices')
    .select('id, invoice_number, status, client_id, issue_date, created_at, assigned_workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('is_quotation', false)
    .not('client_id', 'is', null)
    .order('issue_date', { ascending: false })
    .limit(600);
  if (opts.clientIds) {
    if (opts.clientIds.size === 0) return [];
    q = q.in('client_id', Array.from(opts.clientIds));
  }
  const { data: allInvoices, error } = await q;
  if (error || !allInvoices?.length) return [];
  let invoices: any[] = allInvoices.filter((i: any) => !HIDDEN_STATUS.includes(String(i.status || '').toLowerCase()));
  if (!invoices.length) return [];

  const invoiceIds = invoices.map((i) => i.id);
  const clientIds = Array.from(new Set(invoices.map((i) => i.client_id)));

  const [dealsRes, clientsRes, projectsRes, linesRes, productsRes, assignRes, payRes] = await Promise.all([
    db.from('crm_deals').select('id, invoice_id, stage, salesman_id, paid_at, acc_approved_at').eq('workspace_id', workspaceId).in('invoice_id', invoiceIds),
    db.from('clients').select('id, name, company_name, store_name').in('id', clientIds),
    db.from('projects').select('invoice_id, deal_id, start_date').eq('workspace_id', workspaceId).in('invoice_id', invoiceIds),
    db.from('invoice_line_items').select('invoice_id, package_name, description, quantity').in('invoice_id', invoiceIds),
    db.from('products').select('id, name, duration_type, duration_value, deliverable_unit').eq('workspace_id', workspaceId),
    db.from('client_assignments').select('client_id, user_id, job').eq('workspace_id', workspaceId).in('client_id', clientIds).in('job', ['advertising', 'admin']),
    db.from('journal_entries').select('reference_id, transaction_date').eq('workspace_id', workspaceId).in('reference_id', invoiceIds).in('reference_type', ['bank_match', 'payment', 'payment_tx', 'invoice_payment']).gt('credit_amount', 0),
  ]);

  const dealByInvoice = new Map<string, any>((dealsRes.data || []).map((d: any) => [d.invoice_id, d]));
  if (opts.salesmanId) {
    // A salesman sees the clients of his own cards.
    invoices = invoices.filter((i) => {
      const d = dealByInvoice.get(i.id);
      return d && (!d.salesman_id || d.salesman_id === opts.salesmanId);
    });
    if (!invoices.length) return [];
  }

  const dealIds = (dealsRes.data || []).map((d: any) => d.id);
  const requestsRes = dealIds.length
    ? await db.from('invoice_requests').select('deal_id, items, requested_at').in('deal_id', dealIds).eq('status', 'generated').order('requested_at', { ascending: false })
    : { data: [] as any[] };
  const requestItems = new Map<string, RequestItem[]>();
  for (const r of requestsRes.data || []) if (!requestItems.has(r.deal_id) && r.items?.length) requestItems.set(r.deal_id, r.items);

  const clientById = new Map<string, any>((clientsRes.data || []).map((c: any) => [c.id, c]));
  const projectByInvoice = new Map<string, any>((projectsRes.data || []).map((p: any) => [p.invoice_id, p]));
  const products: any[] = productsRes.data || [];
  const linesByInvoice = new Map<string, any[]>();
  for (const l of linesRes.data || []) linesByInvoice.set(l.invoice_id, [...(linesByInvoice.get(l.invoice_id) || []), l]);
  const handler = (clientId: string, job: string) => (assignRes.data || []).find((a: any) => a.client_id === clientId && a.job === job)?.user_id || null;
  const lastPayment = new Map<string, string>();
  for (const p of payRes.data || []) {
    const cur = lastPayment.get(p.reference_id);
    if (!cur || String(p.transaction_date) > cur) lastPayment.set(p.reference_id, String(p.transaction_date));
  }

  /** The products of one invoice: the salesman's request when there is one, else the invoice lines matched to the catalog by name. */
  const itemsOf = (inv: any, deal: any): RequestItem[] => {
    const fromRequest = deal ? requestItems.get(deal.id) : undefined;
    if (fromRequest?.length) return fromRequest;
    return (linesByInvoice.get(inv.id) || []).map((l: any) => {
      const label = String(l.package_name || l.description || '').trim();
      const key = label.toLowerCase();
      const p = products.find((x) => String(x.name).trim().toLowerCase() === key);
      return {
        product_id: p?.id || null,
        name: label.split('\n')[0] || 'Item',
        quantity: Number(l.quantity || 1),
        unit_price: 0,
        scale: null,
        duration_type: p?.duration_type || 'none',
        duration_value: Number(p?.duration_value || 0),
        deliverable_unit: p?.deliverable_unit || null,
      } as RequestItem;
    });
  };

  const rows: ClientRow[] = [];
  for (const inv of invoices) {
    const client = clientById.get(inv.client_id);
    if (!client) continue;
    const deal = dealByInvoice.get(inv.id);
    const status = String(inv.status || '').toLowerCase();
    const paid = status === 'paid';
    const isDeal = paid || deal?.stage === 'Deal';
    const paidAt: string | null = deal?.paid_at || deal?.acc_approved_at || (paid ? lastPayment.get(inv.id) || null : null);
    const items = itemsOf(inv, deal);
    const lines = items.length ? items : [NO_LINES];
    const start: string | null = projectByInvoice.get(inv.id)?.start_date || null;
    lines.forEach((it, i) => {
      const terms = start ? computeProjectTerms([it], start) : { endDate: null, deliverables: [] };
      rows.push({
        key: `${inv.id}-${i}`,
        invoiceId: inv.id,
        dealId: deal?.id || null,
        clientId: inv.client_id,
        clientName: opts.maskName(client.name, inv.assigned_workspace_id),
        brand: client.company_name || '',
        store: client.store_name || '',
        product: it.name,
        quantity: Number(it.quantity || 1),
        paidAt,
        accApprovedOnly: Boolean(deal && !deal.paid_at && deal.acc_approved_at && !paid),
        start,
        end: terms.endDate,
        endText: terms.deliverables.length ? terms.deliverables.map((x) => `${x.total} ${x.unit}`).join(' · ') : null,
        invoiceNumber: inv.invoice_number || null,
        status: inv.status || null,
        isDeal,
        advertiserId: handler(inv.client_id, 'advertising'),
        adminId: handler(inv.client_id, 'admin'),
        groupSize: lines.length,
        groupIndex: i,
      });
    });
  }
  return rows;
}
