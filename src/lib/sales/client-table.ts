// The Client table: one row per product a client bought, grouped by invoice. Server-side only.
// Built from the INVOICES of the workspace (so every client with an issued invoice shows, whether the invoice came from a
// pipeline card or was made by Accounting directly), joined with the pipeline card (paid / approved date) and the project (start).
// Used by Sales > Client, Optimizing > Clients (with handler assignment) and mirrored in Advertiser / Admin (up to Product).
import { computeProjectTerms, withLengthFromQuantity, type RequestItem } from '@/lib/sales/flow';
import { todayJakarta } from '@/lib/kpi/calendar';
import { PT_WORKSPACE_ID, NEW_WAVE_WORKSPACE_ID } from '@/lib/workspaces/known';

/**
 * Which invoices belong to a workspace's Client table: its own, plus (for a workspace other than PT Pintu) the PT Pintu invoices
 * tagged with that workspace. PT issues and collects the money; the job and the client stay in the tagged workspace.
 * Only the payment is connected. Use as a PostgREST .or() filter.
 */
export const invoiceScope = (workspaceId: string) =>
  workspaceId === PT_WORKSPACE_ID ? `workspace_id.eq.${workspaceId}` : `workspace_id.eq.${workspaceId},and(workspace_id.eq.${PT_WORKSPACE_ID},assigned_workspace_id.eq.${workspaceId})`;

/** finished: the project is done but the client is still with us. churn: the client left (set by hand). */
export type Lifecycle = 'active' | 'scheduled' | 'freeze' | 'finished' | 'churn';

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
  /** The paid date Accounting typed in by hand (YYYY-MM-DD); empty = use the automatic one. */
  paidManual: string | null;
  accApprovedOnly: boolean;
  start: string | null;
  /** The start comes from the invoice's project date, nobody has picked one yet. */
  startAuto: boolean;
  /** Active / Scheduled (project not started) / Freeze (set by hand) / Churn (project ended). */
  lifecycle: Lifecycle;
  /** Freeze or Churn set by hand; null = automatic. */
  override: 'freeze' | 'churn' | 'finished' | null;
  /** Day the project ended (or was marked churn). */
  churnDate: string | null;
  /** Churned in an earlier month: lives on the Churn page, not in Client. */
  archived: boolean;
  /** End date from this product's length, or a deliverable text such as "30 videos". */
  end: string | null;
  endText: string | null;
  invoiceNumber: string | null;
  status: string | null;
  /** The project may start: the invoice is paid, or the deal was approved. */
  isDeal: boolean;
  advertiserId: string | null;
  adminId: string | null;
  /** The salesman who sold this project: set by hand (invoices.sales_name), else the salesman of the pipeline card. */
  salesman: string;
  groupSize: number;
  groupIndex: number;
}

const HIDDEN_STATUS = ['draft', 'void', 'cancelled', 'canceled'];
const NO_LINES: RequestItem = { product_id: null, name: '(no product lines)', quantity: 1, unit_price: 0, scale: null, duration_type: 'none', duration_value: 0, deliverable_unit: null };

type LoadOpts = { salesmanId?: string; clientIds?: Set<string>; archived?: 'hide' | 'only' | 'all'; maskName: (name: string | null | undefined, assignedWorkspaceId?: string | null) => string };

async function loadInvoiceRows(db: Db, workspaceId: string, opts: LoadOpts): Promise<ClientRow[]> {
  // client_paid_date needs one migration; without it the table still works with the automatic paid date.
  const invoiceQuery = (cols: string) => {
    let b = db
      .from('invoices')
      .select(cols)
      .or(invoiceScope(workspaceId))
      .eq('is_quotation', false)
      .not('client_id', 'is', null)
      .order('issue_date', { ascending: false })
      .limit(600);
    if (opts.clientIds) b = b.in('client_id', Array.from(opts.clientIds));
    return b;
  };
  if (opts.clientIds && opts.clientIds.size === 0) return [];
  const base = 'id, invoice_number, status, client_id, issue_date, created_at, assigned_workspace_id, notes';
  let { data: allInvoices, error } = await invoiceQuery(`${base}, client_paid_date, client_status, client_status_at, sales_name`);
  if (error) ({ data: allInvoices, error } = await invoiceQuery(`${base}, client_paid_date, client_status, client_status_at`));
  if (error) ({ data: allInvoices, error } = await invoiceQuery(`${base}, client_paid_date`));
  if (error) ({ data: allInvoices, error } = await invoiceQuery(base));
  if (error || !allInvoices?.length) return [];
  let invoices: any[] = allInvoices.filter((i: any) => !HIDDEN_STATUS.includes(String(i.status || '').toLowerCase()));
  if (!invoices.length) return [];

  const invoiceIds = invoices.map((i) => i.id);
  const clientIds = Array.from(new Set(invoices.map((i) => i.client_id)));

  const [dealsRes, clientsRes, projectsRes, linesRes, productsRes, assignRes, payRes, txPayRes] = await Promise.all([
    db.from('crm_deals').select('id, invoice_id, stage, salesman_id, salesman_name, paid_at, acc_approved_at').eq('workspace_id', workspaceId).in('invoice_id', invoiceIds),
    db.from('clients').select('id, name, company_name, store_name').in('id', clientIds),
    db.from('projects').select('invoice_id, deal_id, start_date').eq('workspace_id', workspaceId).in('invoice_id', invoiceIds),
    db.from('invoice_line_items').select('invoice_id, package_name, description, quantity, scale').in('invoice_id', invoiceIds),
    db.from('products').select('id, name, duration_type, duration_value, deliverable_unit').eq('workspace_id', workspaceId),
    db.from('client_assignments').select('client_id, user_id, job').eq('workspace_id', workspaceId).in('client_id', clientIds).in('job', ['advertising', 'admin']),
    db.from('journal_entries').select('reference_id, transaction_date').in('reference_id', invoiceIds).in('reference_type', ['bank_match', 'payment', 'payment_tx', 'invoice_payment']).gt('credit_amount', 0),
    // Income booked against the invoice (a recorded payment, a matched bank line).
    db.from('transactions').select('invoice_id, transaction_date').in('invoice_id', invoiceIds).eq('type', 'income'),
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

  for (const p of txPayRes.data || []) {
    const cur = lastPayment.get(p.invoice_id);
    if (p.transaction_date && (!cur || String(p.transaction_date) > cur)) lastPayment.set(p.invoice_id, String(p.transaction_date));
  }

  /** The products of one invoice: the salesman's request when there is one, else the invoice lines matched to the catalog by name. */
  const itemsOf = (inv: any, deal: any): RequestItem[] => {
    const fromRequest = deal ? requestItems.get(deal.id) : undefined;
    if (fromRequest?.length) return fromRequest.map((i) => withLengthFromQuantity(i));
    return (linesByInvoice.get(inv.id) || []).map((l: any) => {
      const label = String(l.package_name || l.description || '').trim();
      const key = label.toLowerCase();
      const p = products.find((x) => String(x.name).trim().toLowerCase() === key);
      return {
        product_id: p?.id || null,
        name: label.split('\n')[0] || 'Item',
        quantity: Number(l.quantity || 1),
        unit_price: 0,
        scale: l.scale || p?.scale || null,
        duration_type: 'none',
        duration_value: 0,
        deliverable_unit: null,
      } as RequestItem;
    }).map((i: RequestItem) => withLengthFromQuantity(i));
  };

  const today = todayJakarta();
  type Pending = { inv: any; client: any; deal: any; lines: RequestItem[]; start: string | null; pickedStart: string | null; projectEnd: string | null; override: 'freeze' | 'churn' | 'finished' | null; lifecycle: Lifecycle | 'ended'; churnDate: string | null; paidAt: string | null; paid: boolean; isDeal: boolean };
  const pending: Pending[] = [];
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
    const projectDate = /\[ProjectDate:(\d{4}-\d{2}-\d{2})\]/.exec(inv.notes || '')?.[1] || null;
    const pickedStart: string | null = projectByInvoice.get(inv.id)?.start_date || null;
    const start: string | null = pickedStart || (isDeal ? projectDate : null);
    const override: 'freeze' | 'churn' | 'finished' | null = inv.client_status === 'freeze' || inv.client_status === 'churn' || inv.client_status === 'finished' ? inv.client_status : null;
    const ends = lines.map((it) => (start ? computeProjectTerms([it], start).endDate : null)).filter(Boolean) as string[];
    const projectEnd = ends.length ? ends.sort()[ends.length - 1] : null;
    let lifecycle: Lifecycle | 'ended';
    let churnDate: string | null = null;
    if (override === 'churn') { lifecycle = 'churn'; churnDate = inv.client_status_at || today; }
    else if (override === 'freeze') lifecycle = 'freeze';
    else if (override === 'finished') lifecycle = 'finished';
    else if (!start || start > today) lifecycle = 'scheduled';
    else if (projectEnd && projectEnd < today) lifecycle = 'ended'; // decided below: Finished or Churn
    else lifecycle = 'active';
    pending.push({ inv, client, deal, lines, start, pickedStart, projectEnd, override, lifecycle, churnDate, paidAt, paid, isDeal });
  }

  // A project that ran out is Finished when the client is still in the ecosystem (a running project or a recent purchase in ANY
  // company, matched by client name), and Churn when the client is gone.
  const alive = await aliveClients(db, pending, today);
  const rows: ClientRow[] = [];
  for (const p of pending) {
    const { inv, client, deal, lines, start, pickedStart, override, paidAt, paid, isDeal } = p;
    let lifecycle: Lifecycle;
    let churnDate = p.churnDate;
    if (p.lifecycle === 'ended') {
      if (alive.has(clientNameKey(client.name))) lifecycle = 'finished';
      else { lifecycle = 'churn'; churnDate = p.projectEnd; }
    } else lifecycle = p.lifecycle;
    // A churned client stays in Client until the end of that month, then moves to the Churn page.
    const archived = lifecycle === 'churn' && !!churnDate && churnDate.slice(0, 7) < today.slice(0, 7);
    if (opts.archived === 'only' ? !archived : opts.archived === 'all' ? false : archived) continue;
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
        paidManual: null, // the paid date is automatic (invoice payment); nothing is typed by hand
        accApprovedOnly: Boolean(deal && !deal.paid_at && deal.acc_approved_at && !paid),
        start,
        startAuto: !pickedStart && !!start,
        lifecycle,
        override,
        churnDate,
        archived,
        end: terms.endDate,
        endText: terms.deliverables.length ? terms.deliverables.map((x) => `${x.total} ${x.unit}`).join(' · ') : null,
        invoiceNumber: inv.invoice_number || null,
        status: inv.status || null,
        isDeal,
        salesman: inv.sales_name || deal?.salesman_name || '',
        advertiserId: handler(inv.client_id, 'advertising'),
        adminId: handler(inv.client_id, 'admin'),
        groupSize: lines.length,
        groupIndex: i,
      });
    });
  }
  return rows;
}

/** The same client across the companies: matched by name (each company keeps its own copy of a client). */
const clientNameKey = (name: string) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const RECENT_PURCHASE_DAYS = 90;

/**
 * The clients (by name key) that are still in the ecosystem: a project of this table that is running, scheduled or frozen, or in any
 * company an invoice whose project still runs (or starts later), or a purchase of the last 90 days that has no project yet.
 */
async function aliveClients(db: Db, pending: Array<{ client: any; lifecycle: string; inv: any }>, today: string): Promise<Set<string>> {
  const alive = new Set<string>();
  const ownInvoiceIds = new Set<string>();
  for (const p of pending) {
    ownInvoiceIds.add(p.inv.id);
    if (p.lifecycle === 'active' || p.lifecycle === 'scheduled' || p.lifecycle === 'freeze') alive.add(clientNameKey(p.client.name));
  }
  const wanted = new Set(pending.filter((p) => p.lifecycle === 'ended').map((p) => clientNameKey(p.client.name)).filter((k) => !alive.has(k)));
  if (wanted.size === 0) return alive;

  const { data: allClients } = await db.from('clients').select('id, name').limit(10000);
  const keyById = new Map<string, string>();
  for (const c of allClients || []) { const k = clientNameKey(c.name); if (wanted.has(k)) keyById.set(c.id, k); }
  const ids = Array.from(keyById.keys());
  const recent = new Date(new Date(`${today}T12:00:00Z`).getTime() - RECENT_PURCHASE_DAYS * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: invs } = await db.from('invoices').select('id, client_id, issue_date, status').in('client_id', ids.slice(i, i + 150)).eq('is_quotation', false);
    const others = (invs || []).filter((v: any) => !ownInvoiceIds.has(v.id) && !HIDDEN_STATUS.includes(String(v.status || '').toLowerCase()));
    if (!others.length) continue;
    const { data: projs } = await db.from('projects').select('invoice_id, start_date, end_date').in('invoice_id', others.map((v: any) => v.id));
    const projByInv = new Map<string, any>((projs || []).map((p: any) => [p.invoice_id, p]));
    for (const v of others) {
      const pr = projByInv.get(v.id);
      const running = pr ? (!pr.end_date || String(pr.end_date) >= today || (pr.start_date && String(pr.start_date) > today)) : String(v.issue_date || '') >= recent;
      if (running) alive.add(keyById.get(v.client_id) as string);
    }
  }
  return alive;
}

/**
 * The Client table. With includeAll, every client of the contact book is listed too, also the ones that have no invoice yet
 * (one row, product "No invoice yet"), so each client can be handed to an advertiser and an admin.
 */
export async function loadClientRows(db: Db, workspaceId: string, opts: LoadOpts & { includeAll?: boolean }): Promise<ClientRow[]> {
  let rows = await loadInvoiceRows(db, workspaceId, opts);
  // The Churn archive: newest churn date first (the rows of one invoice stay together).
  if (opts.archived === 'only') {
    const groups: ClientRow[][] = [];
    for (const r of rows) (r.groupIndex === 0 ? groups.push([r]) : groups[groups.length - 1]?.push(r));
    groups.sort((a, b) => String(b[0].churnDate || '').localeCompare(String(a[0].churnDate || '')));
    rows = groups.flat();
  }
  if (!opts.includeAll || opts.archived === 'only' || opts.salesmanId) return rows;

  // Clients that already have an issued invoice are covered above (or archived in Churn).
  const { data: used } = await db.from('invoices').select('client_id, status').or(invoiceScope(workspaceId)).eq('is_quotation', false).not('client_id', 'is', null).limit(3000);
  const hasInvoice = new Set<string>((used || []).filter((i: any) => !HIDDEN_STATUS.includes(String(i.status || '').toLowerCase())).map((i: any) => i.client_id));

  const build = (hide: boolean) => {
    let q = db.from('clients').select('id, name, company_name, store_name, contact_type').eq('workspace_id', workspaceId).neq('contact_type', 'vendor').order('name').limit(1000);
    if (hide) q = q.eq('is_prospect', false);
    return q;
  };
  let { data: clients, error } = await build(true);
  if (error) ({ data: clients, error } = await build(false));
  let list: any[] = (clients || []).filter((c: any) => !hasInvoice.has(c.id) && (!opts.clientIds || opts.clientIds.has(c.id)));
  if (workspaceId !== NEW_WAVE_WORKSPACE_ID && list.length) {
    // New Wave's own clients (Panasonic dealers...) are not Prof's: same name in New Wave, an invoice held for New Wave, or a Panasonic name.
    const norm = (v: string) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const [{ data: nwClients }, { data: nwInvoices }] = await Promise.all([
      db.from('clients').select('name').eq('workspace_id', NEW_WAVE_WORKSPACE_ID).limit(2000),
      db.from('invoices').select('client_id').eq('assigned_workspace_id', NEW_WAVE_WORKSPACE_ID).in('client_id', list.map((c) => c.id)).limit(3000),
    ]);
    const nwNames = new Set((nwClients || []).map((c: any) => norm(c.name)));
    const nwInvoiceClients = new Set((nwInvoices || []).map((i: any) => i.client_id));
    list = list.filter((c) => !nwNames.has(norm(c.name)) && !nwInvoiceClients.has(c.id) && !/panasonic/i.test(String(c.name || '')));
  }
  if (!list.length) return rows;

  const { data: assigns } = await db.from('client_assignments').select('client_id, user_id, job').eq('workspace_id', workspaceId).in('client_id', list.map((c) => c.id)).in('job', ['advertising', 'admin']);
  const handler = (id: string, job: string) => (assigns || []).find((a: any) => a.client_id === id && a.job === job)?.user_id || null;
  // The salesman typed on the client (column added by 20261027_client_sales.sql; without it the Sales stays empty).
  const { data: salesRows, error: salesErr } = await db.from('clients').select('id, sales_name').in('id', list.map((c) => c.id));
  const salesOfClient = new Map<string, string>(salesErr ? [] : (salesRows || []).filter((r: any) => r.sales_name).map((r: any) => [r.id, String(r.sales_name)] as [string, string]));

  const extra: ClientRow[] = list.map((c) => ({
    key: `client-${c.id}`,
    invoiceId: '',
    dealId: null,
    clientId: c.id,
    clientName: opts.maskName(c.name, null),
    brand: c.company_name || '',
    store: c.store_name || '',
    product: 'No invoice yet',
    quantity: 1,
    paidAt: null,
    paidManual: null,
    accApprovedOnly: false,
    start: null,
    startAuto: false,
    lifecycle: 'scheduled' as Lifecycle,
    override: null,
    churnDate: null,
    archived: false,
    end: null,
    endText: null,
    invoiceNumber: null,
    status: null,
    isDeal: false,
    salesman: salesOfClient.get(c.id) || '',
    advertiserId: handler(c.id, 'advertising'),
    adminId: handler(c.id, 'admin'),
    groupSize: 1,
    groupIndex: 0,
  }));
  return [...rows, ...extra];
}
