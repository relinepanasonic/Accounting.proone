import 'server-only';
import { lengthFromQuantity } from '@/lib/sales/flow';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { withoutProspects } from '@/lib/sales/prospects';
import { clientMask } from '@/lib/auth/client-privacy';
import { mrrByMonth } from '@/lib/data/mrr';
import { PT_WORKSPACE_ID, PROF_WORKSPACE_ID, NEW_WAVE_WORKSPACE_ID, workspaceCode } from '@/lib/workspaces/known';
import { SALARY_ACCOUNT_CODES_PUBLIC } from '@/lib/data/dashboard-constants';

/**
 * The accounts that hold salaries. Salary is NOT a separate cost: these lines are already inside COGS (5020 Direct Labor)
 * and Expenses (6001), so they are shown on their own card but never subtracted a second time from the profit.
 */
export const SALARY_ACCOUNT_CODES = SALARY_ACCOUNT_CODES_PUBLIC;

/** Expense-side accounts of the ledger: 5xxx COGS and 6xxx-9xxx expenses (assets, liabilities, equity and income are not costs). */
const isCostAccount = (code: string) => /^[5-9]/.test(code);

/** The rows behind the cards: click a card on the dashboard to see them. */
export interface DashboardDetails {
  invoices: Array<{ id: string; number: string | null; client: string; date: string | null; status: string; total: number; paid: number }>;
  ar: Array<{ id: string; number: string | null; client: string; date: string | null; due: string | null; status: string; balance: number }>;
  costs: Array<{ date: string; code: string; account: string; amount: number; cogs: boolean }>;
  cash: Array<{ date: string | null; label: string; amount: number }>;
}

export type CardKey = 'revenue' | 'paid' | 'avgMonthly' | 'avgOrder' | 'clients' | 'cogs' | 'cost' | 'salary' | 'cash' | 'ar' | 'coverage' | 'expenses';
/** The mini chart of a card and its small per-company numbers (ProOne, PLIG...). */
export interface CardExtra { series: number[]; labels: string[]; split: Array<{ code: string; value: number }> }

export interface DashboardTelemetry {
  totalRevenue: number;
  paidRevenue: number;
  avgMonthlyRevenue: number;
  /** Monthly overhead: total costs (COGS + expenses) per month, and MRR divided by it. */
  monthlyCost: number;
  coverageRatio: number;
  avgOrderValue: number;
  activeClientCount: number;
  newClientCount: number;

  totalCogs: number;
  totalCost: number;
  /** Costs that are not COGS. Overhead (totalCost) = COGS + Expenses. */
  totalExpenses: number;
  totalSalary: number;
  totalCashFlow: number;
  totalAR: number;

  revenueVsCost: {
    labels: string[];
    revenue: number[];
    cost: number[];
    /** Monthly recurring revenue per bucket (in a month view every week shows the MRR of that month). */
    mrr: number[];
  };
  /** MRR of the latest month of the period shown (this month for the current year). */
  currentMrr: number;

  pnl: {
    labels: string[];
    profit: number[];
  };

  liveCash: {
    labels: string[];
    balance: number[];
  };

  /** Overhead by account: COGS (5xxx) and expenses (6xxx to 9xxx) together, biggest first. */
  topOverhead: Array<{ name: string; amount: number }>;
  topClients: Array<{ name: string; revenue: number }>;
  /** What was paid to each vendor in the period (expense transactions), biggest first. */
  topVendors: Array<{ name: string; amount: number }>;
  /** Revenue of the period per salesman (the project's Sales column, else the pipeline card), biggest first. */
  topSales: Array<{ name: string; revenue: number; invoices: number }>;
  topProducts: Array<{ name: string; sold: number; revenue: number }>;

  /** For the filter bar: years that have data, and the client names (masked) of these workspaces. */
  availableYears?: number[];
  clientNames?: string[];
  /** The year the numbers are for. */
  year?: number;
  details?: DashboardDetails;
  cards?: Record<CardKey, CardExtra>;
  /** The Company filter of a single-company dashboard: where the numbers can come from. */
  companyOptions?: Array<{ id: string; name: string }>;
}

export interface DashboardTelemetryOptions {
  monthFilter?: number | null;
  workspaceIds?: string[];
  /** Calendar year of the numbers (default: this year). */
  year?: number;
  /** Only this client (masked name as shown in the filter). Costs are not tied to clients, so they drop out. */
  clientName?: string | null;
  /**
   * Single-company dashboard only: show only the numbers of one source. For Prof Toko: its own books or what PT Pintu holds for it.
   * For PT Pintu: its own books or what it holds for one of the other companies. Empty = everything.
   */
  company?: string | null;
  /** A ready database client (service role) for callers without a login, such as the machine API. Default: the logged-in user's client. */
  db?: any;
  /** Pass the page's own context so it is not fetched a second time. */
  ctx?: Awaited<ReturnType<typeof getAuthenticatedWorkspaceContext>>;
}

export async function getDashboardTelemetry(options: DashboardTelemetryOptions = {}): Promise<DashboardTelemetry> {
  const { monthFilter = null, workspaceIds, clientName = null } = options;
  const startedAt = Date.now();
  const supabase = (options.db || (await createClient())) as Awaited<ReturnType<typeof createClient>>;
  const { activeWorkspaceId, userEmail, availableWorkspaces } = options.ctx || (await getAuthenticatedWorkspaceContext(supabase));
  const mask = clientMask({ userEmail, availableWorkspaces });

  const combined = Boolean(workspaceIds && workspaceIds.length);
  // A single company's dashboard holds its own books plus what PT Pintu paid or collected for it (items assigned to this company).
  const A = activeWorkspaceId;
  const queryWorkspaceIds: string[] = combined ? (workspaceIds as string[]) : A !== PT_WORKSPACE_ID ? [A, PT_WORKSPACE_ID] : [PT_WORKSPACE_ID];
  // PT Pintu's dashboard stands for itself (it is used for tax): the Company filter is for the other companies.
  const companyFilter = !combined && A !== PT_WORKSPACE_ID && options.company ? options.company : '';
  /** Which company an invoice / expense / ledger line counts for in a single-company dashboard; null = not part of this dashboard. */
  const sourceOf = (workspaceId: string, assigned: string | null | undefined): string | null => {
    if (A === PT_WORKSPACE_ID) return assigned || PT_WORKSPACE_ID;
    if (workspaceId === A) return A;
    if (workspaceId === PT_WORKSPACE_ID && assigned === A) return PT_WORKSPACE_ID;
    return null;
  };

  const yearForCosts = options.year ?? new Date().getFullYear();
  // Costs come from the LEDGER (journal entries of the expense accounts), the same numbers as the accounting pages.
  // A bank transaction list also holds loans, taxes payable and equity, which are not costs. Paged: one request returns at most 1000 rows.
  // Expenses PT Pintu paid for a company (transactions assigned to it): their ledger lines count in that company's costs.
  const assignedTx = new Map<string, string>();
  const fetchCostLines = async () => {
    if (clientName) return [] as any[]; // costs are not tied to clients
    const out: any[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('account_code, debit_amount, credit_amount, transaction_date, workspace_id, reference_id')
        .in('workspace_id', queryWorkspaceIds)
        .gte('transaction_date', `${yearForCosts}-01-01`)
        .lte('transaction_date', `${yearForCosts}-12-31`)
        .or('account_code.like.5%,account_code.like.6%,account_code.like.7%,account_code.like.8%,account_code.like.9%')
        .range(from, from + 999);
      if (error || !data) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  };

  // The bank transactions. assigned_workspace_id needs one migration; without it nothing is assigned.
  const fetchTransactions = async () => {
    const q = (cols: string) => supabase.from('transactions').select(cols).in('workspace_id', queryWorkspaceIds);
    const rLinks: any = await q('id, description, amount, due_date, transaction_date, type, client_id, category, reconciled, workspace_id, assigned_workspace_id, intercompany_of');
    if (!rLinks.error) return rLinks;
    const r: any = await q('id, description, amount, due_date, transaction_date, type, client_id, category, reconciled, workspace_id, assigned_workspace_id');
    if (!r.error) return r;
    const r2: any = await q('id, description, amount, due_date, transaction_date, type, client_id, category, reconciled, workspace_id');
    if (!r2.error) return r2;
    return q('id, description, amount, due_date, category, reconciled, workspace_id');
  };

  const productsPromise = (async () => {
    const { data } = await supabase.from('products').select('name, duration_type, duration_value').in('workspace_id', queryWorkspaceIds).eq('duration_type', 'month');
    return (data || []) as Array<{ name: string; duration_type: string | null; duration_value: number | null }>;
  })();
  const [invoicesRes, clientsRes, txRes, rawCostLines, coaRes] = await Promise.all([
    (async (): Promise<any> => {
      // intercompany_of / intercompany_invoice_id come from 20261030_intercompany_billing.sql
      const cols = 'id, invoice_number, status, total_amount, amount_paid, issue_date, due_date, created_at, client_id, workspace_id, assigned_workspace_id, notes, is_quotation, clients(name), invoice_line_items(package_name, description, amount, quantity, scale, unit_price, discount_amount)';
      const withLinks: any = await supabase.from('invoices').select(`${cols}, intercompany_of, intercompany_invoice_id`).eq('is_quotation', false).in('workspace_id', queryWorkspaceIds);
      if (!withLinks.error) return withLinks;
      return supabase.from('invoices').select(cols).eq('is_quotation', false).in('workspace_id', queryWorkspaceIds);
    })(),
    withoutProspects((hide) => {
      let q = supabase.from('clients').select('id, name, created_at').in('workspace_id', combined ? queryWorkspaceIds : [A]);
      if (hide) q = q.eq('is_prospect', false);
      return q;
    }),
    fetchTransactions(),
    fetchCostLines(),
    supabase.from('global_chart_of_accounts').select('account_code, account_name, account_type').in('workspace_id', queryWorkspaceIds),
  ]);

  console.log(`[combined-dashboard] queries ${Date.now() - startedAt} ms (invoices ${invoicesRes.data?.length ?? 0}, transactions ${txRes.data?.length ?? 0})`);
  // Combined view: a PT Pintu invoice that belongs to a workspace you did not pick (for example a New Wave job) stays out.
  // Single-company view: own books + PT items assigned to this company, narrowed by the Company filter.
  const keep = (workspaceId: string, assigned: string | null | undefined) => {
    if (combined) return true;
    const src = sourceOf(workspaceId, assigned);
    return src !== null && (!companyFilter || src === companyFilter);
  };
  // A PT invoice of a New Wave job that New Wave has billed to PT (intercompany_invoice_id) is PT's own revenue: it is tagged for New Wave
  // (client hidden, hour system) but no longer counts as New Wave's. New Wave's revenue is its own invoice to PT.
  const attribution = (inv: any) => (inv.intercompany_invoice_id ? null : inv.assigned_workspace_id);
  // When New Wave and PT are in the same view, that invoice and PT's matching cost cancel out (the group did not earn it twice).
  const eliminate = combined && queryWorkspaceIds.includes(NEW_WAVE_WORKSPACE_ID) && queryWorkspaceIds.includes(PT_WORKSPACE_ID);
  const invoices = (invoicesRes.data || []).filter((inv: any) => {
    if (eliminate && inv.intercompany_of) return false;
    return combined ? !(inv.workspace_id === PT_WORKSPACE_ID && attribution(inv) && !queryWorkspaceIds.includes(attribution(inv))) : keep(inv.workspace_id, attribution(inv));
  });
  for (const tx of (txRes.data || []) as any[]) if (tx.assigned_workspace_id) assignedTx.set(tx.id, tx.assigned_workspace_id);
  const intercompanyCost = new Set<string>(eliminate ? ((txRes.data || []) as any[]).filter((t) => t.intercompany_of).map((t) => t.id as string) : []);
  const costLines = (rawCostLines as any[]).filter((l) => (combined ? !intercompanyCost.has(l.reference_id) : keep(l.workspace_id, l.workspace_id === PT_WORKSPACE_ID ? assignedTx.get(l.reference_id) : null)));
  const clients = clientsRes.data || [];
  // Costs belong to vendors, not clients: with a client chosen they are left out of the numbers.
  const transactions = clientName ? [] : ((txRes.data || []) as any[]).filter((t) => keep(t.workspace_id, t.assigned_workspace_id));

  const currentYear = options.year ?? new Date().getFullYear();

  // Filter bar data: years with data and the client names, before any filter is applied.
  const yearsSeen = new Set<number>([new Date().getFullYear()]);
  for (const inv of invoices) {
    const y = new Date(inv.issue_date || inv.created_at).getFullYear();
    if (Number.isFinite(y)) yearsSeen.add(y);
  }
  for (const tx of txRes.data || []) {
    const y = new Date(tx.due_date || '').getFullYear();
    if (Number.isFinite(y)) yearsSeen.add(y);
  }
  const nameOf = (inv: any) => {
    const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    return mask.name(clientObj?.name, inv.assigned_workspace_id, 'Unknown Client');
  };
  const clientNames: string[] = Array.from(new Set<string>(invoices.filter((i: any) => i.client_id).map(nameOf))).sort((a, b) => a.localeCompare(b));

  // Helper to determine bucket index (0-11 for months, 0-4 for weeks if month filtered)
  const isTargetPeriod = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (d.getFullYear() !== currentYear) return false;
    if (monthFilter !== null && d.getMonth() !== monthFilter) return false;
    return true;
  };

  const getBucketIndex = (dateStr: string | null) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    if (d.getFullYear() !== currentYear) return -1;
    if (monthFilter === null) {
      return d.getMonth(); // 0 - 11
    } else {
      if (d.getMonth() !== monthFilter) return -1;
      return Math.min(4, Math.floor((d.getDate() - 1) / 7)); // 0 - 4
    }
  };

  // MRR: the subscriptions (products with a length in months) spread over the months they run; a month view repeats that month on every week.
  const mrrMonths = mrrByMonth(invoices as any[], await productsPromise, options.year ?? new Date().getFullYear());
  const numBuckets = monthFilter === null ? 12 : 5;
  const mrrBuckets: number[] = monthFilter === null ? mrrMonths : new Array(5).fill(mrrMonths[monthFilter] || 0);
  const nowIdx = new Date().getFullYear() === (options.year ?? new Date().getFullYear()) ? new Date().getMonth() : 11;
  const currentMrr = monthFilter === null ? mrrMonths[nowIdx] || 0 : mrrMonths[monthFilter] || 0;
  const labels = monthFilter === null 
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];

  // Initialize aggregations
  let totalRevenue = 0;
  let paidRevenue = 0;
  let invoiceCount = 0;
  let totalAR = 0;

  const bucketRevenue = new Array(numBuckets).fill(0);
  const bucketCost = new Array(numBuckets).fill(0);
  const bucketProfit = new Array(numBuckets).fill(0);
  const bucketCashFlow = new Array(numBuckets).fill(0);

  const clientRevenueMap = new Map<string, number>();
  const activeClients = new Set<string>();
  const productMap = new Map<string, { sold: number; revenue: number }>();

  const details: DashboardDetails = { invoices: [], ar: [], costs: [], cash: [] };

  // Mini charts and per-company numbers for the cards. The company is the workspace that holds the books (PT Pintu for what it holds for another company).
  const codeOf = (workspaceId: string) => workspaceCode(workspaceId, availableWorkspaces.find((w: any) => w.id === workspaceId)?.name);
  const bucketPaid = new Array(numBuckets).fill(0);
  const bucketCogs = new Array(numBuckets).fill(0);
  const bucketSalary = new Array(numBuckets).fill(0);
  const bucketAr = new Array(numBuckets).fill(0);
  const bucketCount = new Array(numBuckets).fill(0);
  const bucketClients: Array<Set<string>> = Array.from({ length: numBuckets }, () => new Set<string>());
  const split: Record<CardKey, Map<string, number>> = { revenue: new Map(), paid: new Map(), avgMonthly: new Map(), avgOrder: new Map(), clients: new Map(), cogs: new Map(), cost: new Map(), salary: new Map(), cash: new Map(), ar: new Map(), coverage: new Map(), expenses: new Map() };
  const addSplit = (k: CardKey, workspaceId: string, v: number) => split[k].set(codeOf(workspaceId), (split[k].get(codeOf(workspaceId)) || 0) + v);
  const countByCode = new Map<string, number>();
  const clientsByCode = new Map<string, Set<string>>();

  // Process Invoices
  for (const inv of invoices) {
    const d = inv.issue_date || inv.created_at;
    const amt = Number(inv.total_amount || 0);
    const st = (inv.status || 'draft').toLowerCase();
    if (clientName && nameOf(inv) !== clientName) continue;

    // AR is all-time money still owed on issued invoices: the unpaid balance (drafts are not issued yet).
    if (['pending', 'overdue', 'sent', 'invoiced', 'partial_paid'].includes(st)) {
      const balance = Math.max(0, amt - Number(inv.amount_paid || 0));
      totalAR += balance;
      if (balance > 0) {
        addSplit('ar', inv.workspace_id, balance);
        const ab = getBucketIndex(d);
        if (ab !== -1) bucketAr[ab] += balance;
      }
      if (balance > 0) details.ar.push({ id: inv.id, number: inv.invoice_number, client: nameOf(inv), date: d, due: inv.due_date, status: st, balance });
    }

    if (!isTargetPeriod(d)) continue;
    // A draft is not issued yet: it is neither revenue nor money to collect.
    if (st === 'cancelled' || st === 'draft') continue;

    details.invoices.push({ id: inv.id, number: inv.invoice_number, client: nameOf(inv), date: d, status: st, total: amt, paid: Number(inv.amount_paid || 0) });
    totalRevenue += amt;
    invoiceCount++;
    const bIdx = getBucketIndex(d);
    addSplit('revenue', inv.workspace_id, amt);
    countByCode.set(codeOf(inv.workspace_id), (countByCode.get(codeOf(inv.workspace_id)) || 0) + 1);
    if (bIdx !== -1) {
      bucketCount[bIdx]++;
      bucketRevenue[bIdx] += amt;
      bucketProfit[bIdx] += amt; // Add revenue to profit
    }

    if (st === 'paid') {
      details.cash.push({ date: d, label: `${inv.invoice_number || 'Invoice'} · ${nameOf(inv)}`, amount: amt });
      paidRevenue += amt;
      addSplit('paid', inv.workspace_id, amt);
      addSplit('cash', inv.workspace_id, amt);
      if (bIdx !== -1) { bucketCashFlow[bIdx] += amt; bucketPaid[bIdx] += amt; } // Cash in
    }

    if (inv.client_id) {
      activeClients.add(inv.client_id);
      if (bIdx !== -1) bucketClients[bIdx].add(inv.client_id);
      if (!clientsByCode.has(codeOf(inv.workspace_id))) clientsByCode.set(codeOf(inv.workspace_id), new Set());
      clientsByCode.get(codeOf(inv.workspace_id))!.add(inv.client_id);
      const cName = nameOf(inv);
      clientRevenueMap.set(cName, (clientRevenueMap.get(cName) || 0) + amt);
    }

    if (Array.isArray(inv.invoice_line_items)) {
      for (const item of inv.invoice_line_items) {
        const iAmt = Number(item.amount || 0);
        const iQty = Number(item.quantity || 1);
        const name = item.package_name || item.description || 'Unknown Item';
        const curr = productMap.get(name) || { sold: 0, revenue: 0 };
        productMap.set(name, { sold: curr.sold + iQty, revenue: curr.revenue + iAmt });
      }
    }
  }

  // Monthly revenue (recognized): an invoice for a 3 month project counts 1/3 in each of its 3 months, a 2 week job by its days,
  // anything with no length (pc, video...) in the month it was issued. Shows what each month really carries, against the monthly overhead.
  const recognized = new Array(12).fill(0);
  const recognizedSplit = new Map<string, number[]>();
  const spread = (workspaceId: string, start: Date, amount: number, len: ReturnType<typeof lengthFromQuantity>) => {
    const code = codeOf(workspaceId);
    const arr = recognizedSplit.get(code) || new Array(12).fill(0);
    recognizedSplit.set(code, arr);
    const put = (y: number, m: number, v: number) => { if (y === currentYear) { recognized[m] += v; arr[m] += v; } };
    const y0 = start.getUTCFullYear(), m0 = start.getUTCMonth();
    if (len.duration_type === 'month' && len.duration_value > 1) {
      for (let k = 0; k < len.duration_value; k++) { const t = m0 + k; put(y0 + Math.floor(t / 12), t % 12, amount / len.duration_value); }
    } else if (len.duration_type === 'day' && len.duration_value > 1) {
      for (let k = 0; k < len.duration_value; k++) { const dt = new Date(start.getTime() + k * 86400000); put(dt.getUTCFullYear(), dt.getUTCMonth(), amount / len.duration_value); }
    } else put(y0, m0, amount);
  };
  for (const inv of invoices) {
    if (clientName && nameOf(inv) !== clientName) continue;
    const st = (inv.status || 'draft').toLowerCase();
    if (st === 'cancelled' || st === 'draft') continue;
    const total = Number(inv.total_amount || 0);
    const start = new Date(String(inv.issue_date || inv.created_at).slice(0, 10) + 'T12:00:00Z');
    if (Number.isNaN(start.getTime())) continue;
    const lines: any[] = Array.isArray(inv.invoice_line_items) ? inv.invoice_line_items : [];
    const sum = lines.reduce((a, l) => a + Number(l.amount || 0), 0);
    if (!lines.length || sum <= 0) { spread(inv.workspace_id, start, total, lengthFromQuantity(0)); continue; }
    for (const l of lines) spread(inv.workspace_id, start, (Number(l.amount || 0) / sum) * total, lengthFromQuantity(Number(l.quantity || 0), l.scale));
  }

  // A new client is one whose first issued invoice falls in the period, so new clients are always part of the active clients.
  // (Counting rows of the client list also counted vendors and contacts that never bought.)
  const firstInvoiceDay = new Map<string, string>();
  for (const inv of invoices) {
    const st = (inv.status || 'draft').toLowerCase();
    if (st === 'cancelled' || st === 'draft' || !inv.client_id) continue;
    if (clientName && nameOf(inv) !== clientName) continue;
    const day = String(inv.issue_date || inv.created_at).slice(0, 10);
    const cur = firstInvoiceDay.get(inv.client_id);
    if (!cur || day < cur) firstInvoiceDay.set(inv.client_id, day);
  }
  let newClientCount = 0;
  for (const day of firstInvoiceDay.values()) if (isTargetPeriod(day)) newClientCount++;

  // Cash out: bank transactions that were reconciled (cash view only; costs below come from the ledger).
  for (const tx of transactions) {
    if (!isTargetPeriod(tx.due_date) || !tx.reconciled) continue;
    const bIdx = getBucketIndex(tx.due_date);
    if (bIdx !== -1) bucketCashFlow[bIdx] -= Number(tx.amount || 0);
    addSplit('cash', tx.workspace_id, -Number(tx.amount || 0));
    details.cash.push({ date: tx.due_date, label: tx.description || tx.category || 'Expense', amount: -Number(tx.amount || 0) });
  }

  // Costs from the ledger, per account.
  const coaByCode = new Map<string, { name: string; type: string }>();
  for (const a of coaRes.data || []) if (!coaByCode.has(a.account_code)) coaByCode.set(a.account_code, { name: a.account_name, type: String(a.account_type || '') });

  let totalCogs = 0;
  let totalCost = 0;
  let totalSalary = 0;
  const expenseCoaMap = new Map<string, number>();
  const bucketExpenses = new Array(numBuckets).fill(0);

  for (const line of costLines) {
    const code = String(line.account_code || '');
    if (!isCostAccount(code) || !isTargetPeriod(line.transaction_date)) continue;
    const amt = Number(line.debit_amount || 0) - Number(line.credit_amount || 0);
    if (!amt) continue;

    totalCost += amt;
    const bIdx = getBucketIndex(line.transaction_date);
    addSplit('cost', line.workspace_id, amt);
    if (bIdx !== -1) {
      bucketCost[bIdx] += amt;
      bucketProfit[bIdx] -= amt;
    }

    const coa = coaByCode.get(code);
    const isCogs = coa ? /cogs|cost of goods|cost of sales/i.test(coa.type) : code.startsWith('5');
    if (!isCogs) { addSplit('expenses', line.workspace_id, amt); if (bIdx !== -1) bucketExpenses[bIdx] += amt; }
    if (isCogs) { totalCogs += amt; addSplit('cogs', line.workspace_id, amt); if (bIdx !== -1) bucketCogs[bIdx] += amt; }
    if (SALARY_ACCOUNT_CODES.includes(code)) { totalSalary += amt; addSplit('salary', line.workspace_id, amt); if (bIdx !== -1) bucketSalary[bIdx] += amt; } // already inside COGS / expenses: informational

    details.costs.push({ date: String(line.transaction_date).slice(0, 10), code, account: coa?.name || 'Account', amount: amt, cogs: isCogs });
    // Top 10 Overhead: every cost account, COGS and expenses together (the Overhead card is COGS + Expenses).
    const label = `${code} - ${coa?.name || 'Account'}`;
    expenseCoaMap.set(label, (expenseCoaMap.get(label) || 0) + amt);
  }

  const avgOrderValue = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;
  
  let monthsWithData = 0;
  if (monthFilter === null) {
    for (let i = 0; i < 12; i++) {
      if (bucketRevenue[i] > 0) monthsWithData++;
    }
  }
  const recognizedMonths = recognized.filter((v) => v > 0.5).length;
  const avgMonthlyRevenue = monthFilter === null
    ? (recognizedMonths > 0 ? recognized.reduce((a, b) => a + b, 0) / recognizedMonths : 0)
    : recognized[monthFilter] || 0;
  const costMonths = bucketCost.filter((v: number) => v > 0.5).length;
  const monthlyCost = monthFilter === null
    ? (costMonths > 0 ? totalCost / costMonths : 0)
    : totalCost;
  const coverageRatio = monthlyCost > 0 ? avgMonthlyRevenue / monthlyCost : 0;

  // Cash = what was already there when the period began + cash in - cash out. (Cash in: paid invoices. Cash out: reconciled bank transactions.)
  const periodStart = monthFilter === null ? `${currentYear}-01-01` : `${currentYear}-${String(monthFilter + 1).padStart(2, '0')}-01`;
  let openingCash = 0;
  for (const inv of invoices) {
    if (String(inv.status || '').toLowerCase() !== 'paid' || (clientName && nameOf(inv) !== clientName)) continue;
    if (String(inv.issue_date || inv.created_at || '').slice(0, 10) < periodStart) {
      openingCash += Number(inv.total_amount || 0);
      addSplit('cash', inv.workspace_id, Number(inv.total_amount || 0));
    }
  }
  for (const tx of transactions) {
    if (tx.reconciled && tx.due_date && String(tx.due_date).slice(0, 10) < periodStart) {
      openingCash -= Number(tx.amount || 0);
      addSplit('cash', tx.workspace_id, -Number(tx.amount || 0));
    }
  }
  // The Live Cash chart follows Buku Bank too (set below when statements exist): its last point is the Total Cash number.
  let bookCashSeries: number[] | null = null;
  let totalCashFlow = openingCash + paidRevenue - transactions.filter(t => isTargetPeriod(t.due_date) && t.reconciled).reduce((s, t) => s + Number(t.amount), 0);

  // Total Cash is the Buku Bank total of the period (opening saldo + cash in - cash out of the stored statements) when statements are uploaded.
  // A client-only view has no bank lines (the bank is not tied to clients), so it keeps the figure above.
  if (!clientName) {
    // ProOne and PLIG are shown side by side: the ProOne dashboard also reads the PLIG bank.
    const bookWorkspaces = combined ? (workspaceIds as string[]) : A === PROF_WORKSPACE_ID ? [A, PT_WORKSPACE_ID] : [A];
    const periodEnd = monthFilter === null ? `${currentYear}-12-31` : `${currentYear}-${String(monthFilter + 1).padStart(2, '0')}-${String(new Date(currentYear, monthFilter + 1, 0).getDate()).padStart(2, '0')}`;
    const bookLines: { workspace_id: string; bank_account_id: string; date: string; txn_time: string | null; amount: number; balance: number | null }[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .select('workspace_id, bank_account_id, date, txn_time, amount, balance')
        .in('workspace_id', bookWorkspaces)
        .lte('date', periodEnd)
        .order('date', { ascending: true })
        .range(from, from + 999);
      if (error || !data) break; // the Buku Bank tables are not there yet: keep the figure above
      bookLines.push(...(data as any[]));
      if (data.length < 1000) break;
    }
    if (bookLines.length > 0) {
      // Per bank: the opening is the saldo of the last line before the period (the total of the month before); a bank whose statements carry
      // no saldo starts from the sum of its earlier lines. Then add the cash in and out of the period. The cards of each company use the same rule.
      let bookTotal = 0;
      let bookOpening = 0;
      const bucketNet: number[] = new Array(numBuckets).fill(0);
      const perCompany = new Map<string, number>();
      const banks = Array.from(new Set(bookLines.map((l) => l.bank_account_id)));
      for (const id of banks) {
        const ofBank = bookLines.filter((l) => l.bank_account_id === id).sort((x, y) => `${String(x.date).slice(0, 10)} ${x.txn_time || ''}`.localeCompare(`${String(y.date).slice(0, 10)} ${y.txn_time || ''}`));
        const before = ofBank.filter((l) => String(l.date).slice(0, 10) < periodStart);
        const inPeriod = ofBank.filter((l) => String(l.date).slice(0, 10) >= periodStart);
        const prev = [...before].reverse().find((l) => l.balance !== null && l.balance !== undefined);
        let opening = 0;
        if (prev) opening = Number(prev.balance);
        else if (before.length === 0 && ofBank[0] && ofBank[0].balance !== null && ofBank[0].balance !== undefined) opening = Number(ofBank[0].balance) - Number(ofBank[0].amount);
        else opening = before.reduce((sum, l) => sum + Number(l.amount || 0), 0);
        const total = opening + inPeriod.reduce((sum, l) => sum + Number(l.amount || 0), 0);
        bookOpening += opening;
        for (const l of inPeriod) { const bi = getBucketIndex(String(l.date).slice(0, 10)); if (bi !== -1) bucketNet[bi] += Number(l.amount || 0); }
        bookTotal += total;
        perCompany.set(ofBank[0].workspace_id, (perCompany.get(ofBank[0].workspace_id) || 0) + total);
      }
      totalCashFlow = bookTotal;
      // Balance at the end of each month (or week): the opening of the period plus the cash in and out up to then.
      let running = bookOpening;
      bookCashSeries = bucketNet.map((n) => (running += n));
      split.cash.clear();
      for (const [wsId, v] of perCompany) addSplit('cash', wsId, v);
    }
  }

  // Cumulative Live Cash
  const liveCashBalance = new Array(numBuckets).fill(0);
  let runningCash = openingCash;
  for (let i = 0; i < numBuckets; i++) {
    runningCash += bucketCashFlow[i];
    liveCashBalance[i] = bookCashSeries ? bookCashSeries[i] : runningCash;
  }

  const topOverhead = Array.from(expenseCoaMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Top vendors: the expense transactions of the period, by the vendor's name (the client_id of the transaction, or the "Vendor | note" text of a quick expense).
  const vendorTotals = new Map<string, number>();
  if (!clientName) {
    const vendorName = new Map<string, string>();
    const { data: vendorRows } = await supabase.from('clients').select('id, name').in('workspace_id', queryWorkspaceIds).eq('contact_type', 'vendor').range(0, 4999);
    for (const v of (vendorRows || []) as any[]) vendorName.set(v.id, String(v.name || '').trim());
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      if (!isTargetPeriod(tx.transaction_date || tx.due_date)) continue;
      const text = String(tx.description || '');
      const name = (tx.client_id && vendorName.get(tx.client_id)) || (text.includes(' | ') ? text.split(' | ')[0].trim() : '') || 'No vendor';
      vendorTotals.set(name, (vendorTotals.get(name) || 0) + Number(tx.amount || 0));
    }
  }
  const topVendors = Array.from(vendorTotals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => (a.name === 'No vendor' ? 1 : b.name === 'No vendor' ? -1 : b.amount - a.amount))
    .slice(0, 10);

  // Top sales: the revenue of the period per salesman. The Sales column of the project (invoices.sales_name, needs one migration)
  // wins; else the salesman of the pipeline card; else "Not assigned".
  const salesOfInvoice = new Map<string, string>();
  if (!clientName) {
    const ids = invoices.map((i: any) => i.id);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const [dealRes, nameRes] = await Promise.all([
        supabase.from('crm_deals').select('invoice_id, salesman_name').in('invoice_id', chunk),
        supabase.from('invoices').select('id, sales_name').in('id', chunk).not('sales_name', 'is', null),
      ]);
      for (const d of ((dealRes as any).data || []) as any[]) if (d.invoice_id && d.salesman_name) salesOfInvoice.set(d.invoice_id, String(d.salesman_name).trim());
      if (!(nameRes as any).error) for (const n of ((nameRes as any).data || []) as any[]) if (n.sales_name) salesOfInvoice.set(n.id, String(n.sales_name).trim());
    }
  }
  const salesTotals = new Map<string, { revenue: number; invoices: number }>();
  for (const inv of clientName ? [] : invoices) {
    const st = String(inv.status || 'draft').toLowerCase();
    if (st === 'cancelled' || st === 'draft') continue;
    if (!isTargetPeriod(inv.issue_date || inv.created_at)) continue;
    const name = salesOfInvoice.get(inv.id) || 'Not assigned';
    const cur = salesTotals.get(name) || { revenue: 0, invoices: 0 };
    cur.revenue += Number(inv.total_amount || 0);
    cur.invoices++;
    salesTotals.set(name, cur);
  }
  const topSales = Array.from(salesTotals.entries())
    .map(([name, v]) => ({ name, revenue: v.revenue, invoices: v.invoices }))
    .sort((a, b) => (a.name === 'Not assigned' ? 1 : b.name === 'Not assigned' ? -1 : b.revenue - a.revenue))
    .slice(0, 10);

  const topClients = Array.from(clientRevenueMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const topProducts = Array.from(productMap.entries())
    .map(([name, val]) => ({ name, sold: val.sold, revenue: val.revenue }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 10);

  return {
    totalRevenue,
    paidRevenue,
    avgMonthlyRevenue,
    monthlyCost,
    coverageRatio,
    avgOrderValue,
    activeClientCount: activeClients.size,
    newClientCount,
    totalCogs,
    totalCost,
    totalExpenses: totalCost - totalCogs,
    totalSalary,
    totalCashFlow,
    totalAR,
    revenueVsCost: {
      labels,
      revenue: bucketRevenue,
      cost: bucketCost,
      mrr: mrrBuckets,
    },
    currentMrr,
    pnl: {
      labels,
      profit: bucketProfit,
    },
    liveCash: {
      labels,
      balance: liveCashBalance,
    },
    topOverhead,
    topClients,
    topVendors,
    topSales,
    topProducts,
    availableYears: Array.from(yearsSeen).sort((a, b) => b - a),
    clientNames,
    year: currentYear,
    details,
    cards: buildCards(),
    companyOptions: combined ? undefined : companyOptions(),
  };

  function buildCards(): Record<CardKey, CardExtra> {
    // ProOne always on top, then PLIG, then the others by size.
    const RANK: Record<string, number> = { ProOne: 0, PLIG: 1, NW: 2, DOA: 3 };
    const byCompany = (a: { code: string; value: number }, b: { code: string; value: number }) => (RANK[a.code] ?? 9) - (RANK[b.code] ?? 9) || b.value - a.value;
    const toSplit = (m: Map<string, number>, f: (code: string, v: number) => number = (_c, v) => v) =>
      Array.from(m.entries()).map(([code, v]) => ({ code, value: f(code, v) })).sort(byCompany);
    // The cards that always show ProOne and PLIG (when in this dashboard), even with a zero.
    const scopeCodes = new Set(queryWorkspaceIds.map((id) => codeOf(id)));
    const withBoth = (rows: { code: string; value: number }[]) => {
      const out = [...rows];
      for (const c of ['ProOne', 'PLIG']) if (scopeCodes.has(c) && !out.some((x) => x.code === c)) out.push({ code: c, value: 0 });
      return out.sort(byCompany);
    };
    const months = monthFilter === null ? Math.max(1, recognizedMonths) : 1;
    const recSplit = Array.from(recognizedSplit.entries()).map(([code, arr]) => ({ code, value: monthFilter === null ? arr.reduce((a, b) => a + b, 0) / months : arr[monthFilter] || 0 })).filter((x) => x.value > 0.5).sort(byCompany);
    // Coverage per company: its MRR over its monthly overhead.
    const costDiv = monthFilter === null ? Math.max(1, costMonths) : 1;
    const coverageSplit = withBoth(Array.from(new Set([...recSplit.map((x) => x.code), ...split.cost.keys()])).map((code) => {
      const mrr = recSplit.find((x) => x.code === code)?.value || 0;
      const oh = (split.cost.get(code) || 0) / costDiv;
      return { code, value: oh > 0 ? mrr / oh : 0 };
    }));
    const orderSeries = bucketRevenue.map((v: number, i: number) => (bucketCount[i] ? v / bucketCount[i] : 0));
    return {
      revenue: { series: bucketRevenue, labels, split: toSplit(split.revenue) },
      paid: { series: bucketPaid, labels, split: toSplit(split.paid) },
      avgMonthly: { series: monthFilter === null ? recognized : bucketRevenue, labels, split: recSplit },
      avgOrder: { series: orderSeries, labels, split: toSplit(split.revenue, (c, v) => (countByCode.get(c) ? v / (countByCode.get(c) as number) : 0)) },
      clients: { series: bucketClients.map((x) => x.size), labels, split: Array.from(clientsByCode.entries()).map(([code, set]) => ({ code, value: set.size })).sort(byCompany) },
      cogs: { series: bucketCogs, labels, split: toSplit(split.cogs) },
      cost: { series: bucketCost, labels, split: toSplit(split.cost) },
      salary: { series: bucketSalary, labels, split: toSplit(split.salary) },
      cash: { series: liveCashBalance, labels, split: withBoth(toSplit(split.cash)) },
      ar: { series: bucketAr, labels, split: withBoth(toSplit(split.ar)) },
      expenses: { series: bucketExpenses, labels, split: toSplit(split.expenses) },
      coverage: { series: monthFilter === null ? recognized.map((v: number, i: number) => (bucketCost[i] > 0 ? v / bucketCost[i] : 0)) : [], labels, split: coverageSplit },
    };
  }

  /** The Company filter: this company's own books and the other source(s) behind it. */
  function companyOptions() {
    const name = (id: string) => availableWorkspaces.find((w: any) => w.id === id)?.name || (id === PT_WORKSPACE_ID ? 'PT Pintu Langit Inovasi Global' : 'Company');
    if (A !== PT_WORKSPACE_ID) return [{ id: A, name: name(A) }, { id: PT_WORKSPACE_ID, name: `${name(PT_WORKSPACE_ID)} (assigned to ${name(A)})` }];
    const others = new Set<string>();
    for (const inv of invoicesRes.data || []) if ((inv as any).assigned_workspace_id) others.add((inv as any).assigned_workspace_id);
    for (const tx of (txRes.data || []) as any[]) if (tx.assigned_workspace_id) others.add(tx.assigned_workspace_id);
    return [{ id: PT_WORKSPACE_ID, name: name(PT_WORKSPACE_ID) }, ...Array.from(others).map((id) => ({ id, name: name(id) }))];
  }
}
