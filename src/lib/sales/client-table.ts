// The Client table: one row per product a client bought, grouped by deal. Server-side only.
// Used by Sales > Client (full, with payment status) and mirrored in Advertiser / Admin (assigned clients, up to Product).
import { computeProjectTerms, type RequestItem } from '@/lib/sales/flow';
import { dealItems } from '@/lib/sales/server';

type Db = any;

export interface ClientRow {
  key: string;
  dealId: string;
  clientId: string;
  clientName: string;
  brand: string;
  store: string;
  product: string;
  quantity: number;
  /** ISO time the invoice was paid (or Accounting approved it without payment). */
  paidAt: string | null;
  accApprovedOnly: boolean;
  start: string | null;
  /** End date from this product's length, or a deliverable text such as "30 videos". */
  end: string | null;
  endText: string | null;
  invoiceNumber: string | null;
  status: string | null;
  isDeal: boolean;
  advertiserId: string | null;
  adminId: string | null;
  groupSize: number;
  groupIndex: number;
}

export async function loadClientRows(
  db: Db,
  workspaceId: string,
  opts: { salesmanId?: string; clientIds?: Set<string>; maskName: (name: string | null | undefined, assignedWorkspaceId?: string | null) => string }
): Promise<ClientRow[]> {
  let q = db
    .from('crm_deals')
    .select('id, client_id, stage, invoice_id, salesman_id, paid_at, acc_approved_at, created_at')
    .eq('workspace_id', workspaceId)
    .in('stage', ['Invoice', 'Deal'])
    .not('invoice_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(400);
  if (opts.salesmanId) q = q.or(`salesman_id.eq.${opts.salesmanId},salesman_id.is.null`);
  const { data: allDeals, error } = await q;
  if (error || !allDeals?.length) return [];
  const deals = opts.clientIds ? allDeals.filter((d: any) => opts.clientIds!.has(d.client_id)) : allDeals;
  if (!deals.length) return [];

  const dealIds = deals.map((d: any) => d.id);
  const clientIds = Array.from(new Set(deals.map((d: any) => d.client_id).filter(Boolean)));
  const invoiceIds = deals.map((d: any) => d.invoice_id);

  const [clientsRes, invoicesRes, projectsRes, requestsRes, assignRes] = await Promise.all([
    db.from('clients').select('id, name, company_name, store_name').in('id', clientIds),
    db.from('invoices').select('id, invoice_number, status, assigned_workspace_id').in('id', invoiceIds),
    db.from('projects').select('deal_id, start_date').in('deal_id', dealIds),
    db.from('invoice_requests').select('deal_id, items, requested_at').in('deal_id', dealIds).eq('status', 'generated').order('requested_at', { ascending: false }),
    db.from('client_assignments').select('client_id, user_id, job').eq('workspace_id', workspaceId).in('client_id', clientIds).in('job', ['advertising', 'admin']),
  ]);

  const clientById = new Map<string, any>((clientsRes.data || []).map((c: any) => [c.id, c]));
  const invoiceById = new Map<string, any>((invoicesRes.data || []).map((i: any) => [i.id, i]));
  const projectByDeal = new Map<string, any>((projectsRes.data || []).map((p: any) => [p.deal_id, p]));
  const itemsByDeal = new Map<string, RequestItem[]>();
  for (const r of requestsRes.data || []) if (!itemsByDeal.has(r.deal_id) && r.items?.length) itemsByDeal.set(r.deal_id, r.items);
  const handler = (clientId: string, job: string) => (assignRes.data || []).find((a: any) => a.client_id === clientId && a.job === job)?.user_id || null;

  const rows: ClientRow[] = [];
  for (const d of deals) {
    const client = clientById.get(d.client_id);
    const inv = invoiceById.get(d.invoice_id);
    if (!client || !inv) continue;
    const items = itemsByDeal.get(d.id) || (await dealItems(db, workspaceId, d));
    const lines: RequestItem[] = items.length
      ? items
      : [{ product_id: null, name: '(no product lines)', quantity: 1, unit_price: 0, scale: null, duration_type: 'none', duration_value: 0, deliverable_unit: null }];
    const start: string | null = projectByDeal.get(d.id)?.start_date || null;
    const isDeal = d.stage === 'Deal';
    lines.forEach((it, i) => {
      const terms = start ? computeProjectTerms([it], start) : { endDate: null, deliverables: [] };
      rows.push({
        key: `${d.id}-${i}`,
        dealId: d.id,
        clientId: d.client_id,
        clientName: opts.maskName(client.name, inv.assigned_workspace_id),
        brand: client.company_name || '',
        store: client.store_name || '',
        product: it.name,
        quantity: Number(it.quantity || 1),
        paidAt: isDeal ? d.paid_at || d.acc_approved_at || null : null,
        accApprovedOnly: isDeal && !d.paid_at && Boolean(d.acc_approved_at),
        start,
        end: terms.endDate,
        endText: terms.deliverables.length ? terms.deliverables.map((x) => `${x.total} ${x.unit}`).join(' · ') : null,
        invoiceNumber: inv.invoice_number || null,
        status: inv.status || null,
        isDeal,
        advertiserId: handler(d.client_id, 'advertising'),
        adminId: handler(d.client_id, 'admin'),
        groupSize: lines.length,
        groupIndex: i,
      });
    });
  }
  return rows;
}
