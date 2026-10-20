import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { withoutProspects } from '@/lib/sales/prospects';
import { clientMask } from '@/lib/auth/client-privacy';
import { PT_WORKSPACE_ID, workspaceCode } from '@/lib/workspaces/known';
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

export type CardKey = 'revenue' | 'paid' | 'avgMonthly' | 'avgOrder' | 'clients' | 'cogs' | 'cost' | 'salary' | 'cash' | 'ar';
/** The mini chart of a card and its small per-company numbers (ProOne, PLIG...). */
export interface CardExtra { series: number[]; labels: string[]; split: Array<{ code: string; value: number }> }

export interface DashboardTelemetry {
  totalRevenue: number;
  paidRevenue: number;
  avgMonthlyRevenue: number;
  avgOrderValue: number;
  activeClientCount: number;
  newClientCount: number;

  totalCogs: number;
  totalCost: number;
  totalSalary: number;
  totalCashFlow: number;
  totalAR: number;

  revenueVsCost: {
    labels: string[];
    revenue: number[];
    cost: number[];
  };

  pnl: {
    labels: string[];
    profit: number[];
  };

  liveCash: {
    labels: string[];
    balance: number[];
  };

  topExpenses: Array<{ name: string; amount: number }>;
  topClients: Array<{ name: string; revenue: number }>;
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
  /** Pass the page's own context so it is not fetched a second time. */
  ctx?: Awaited<ReturnType<typeof getAuthenticatedWorkspaceContext>>;
}

export async function getDashboardTelemetry(options: DashboardTelemetryOptions = {}): Promise<DashboardTelemetry> {
  const { monthFilter = null, workspaceIds, clientName = null } = options;
  const startedAt = Date.now();
  const supabase = await createClient();
  const { activeWorkspaceId, userEmail, availableWorkspaces } = options.ctx || (await getAuthenticatedWorkspaceContext(supabase));
  const mask = clientMask({ userEmail, availableWorkspaces });

  const combined = Boolean(workspaceIds && workspaceIds.length);
  // A single company's dashboard holds its own books plus what PT Pintu paid or collected for it (items assigned to this company).
  const A = activeWorkspaceId;
  const queryWorkspaceIds: string[] = combined ? (workspaceIds as string[]) : A !== PT_WORKSPACE_ID ? [A, PT_WORKSPACE_ID] : [PT_WORKSPACE_ID];
  const companyFilter = !combined && options.company ? options.company : '';
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
    const r: any = await q('id, description, amount, due_date, category, reconciled, workspace_id, assigned_workspace_id');
    if (!r.error) return r;
    return q('id, description, amount, due_date, category, reconciled, workspace_id');
  };

  const [invoicesRes, clientsRes, txRes, rawCostLines, coaRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, issue_date, due_date, created_at, client_id, workspace_id, assigned_workspace_id, clients(name), invoice_line_items(package_name, description, amount, quantity)')
      .eq('is_quotation', false)
      .in('workspace_id', queryWorkspaceIds),
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
  const invoices = (invoicesRes.data || []).filter((inv: any) => (combined ? !(inv.workspace_id === PT_WORKSPACE_ID && inv.assigned_workspace_id && !queryWorkspaceIds.includes(inv.assigned_workspace_id)) : keep(inv.workspace_id, inv.assigned_workspace_id)));
  for (const tx of (txRes.data || []) as any[]) if (tx.assigned_workspace_id) assignedTx.set(tx.id, tx.assigned_workspace_id);
  const costLines = (rawCostLines as any[]).filter((l) => (combined ? true : keep(l.workspace_id, l.workspace_id === PT_WORKSPACE_ID ? assignedTx.get(l.reference_id) : null)));
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
  const clientNames = Array.from(new Set(invoices.filter((i: any) => i.client_id).map(nameOf))).sort((a, b) => a.localeCompare(b));

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

  const numBuckets = monthFilter === null ? 12 : 5;
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
  const split: Record<CardKey, Map<string, number>> = { revenue: new Map(), paid: new Map(), avgMonthly: new Map(), avgOrder: new Map(), clients: new Map(), cogs: new Map(), cost: new Map(), salary: new Map(), cash: new Map(), ar: new Map() };
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
    if (st === 'cancelled') continue;

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

  let newClientCount = 0;
  for (const c of clientName ? [] : clients) {
    if (isTargetPeriod(c.created_at)) {
      newClientCount++;
    }
  }

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
    if (isCogs) { totalCogs += amt; addSplit('cogs', line.workspace_id, amt); if (bIdx !== -1) bucketCogs[bIdx] += amt; }
    if (SALARY_ACCOUNT_CODES.includes(code)) { totalSalary += amt; addSplit('salary', line.workspace_id, amt); if (bIdx !== -1) bucketSalary[bIdx] += amt; } // already inside COGS / expenses: informational

    details.costs.push({ date: String(line.transaction_date).slice(0, 10), code, account: coa?.name || 'Account', amount: amt, cogs: isCogs });
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
  const avgMonthlyRevenue = monthFilter === null 
    ? (monthsWithData > 0 ? totalRevenue / monthsWithData : 0)
    : totalRevenue; // If 1 month selected, avg monthly is just that month's revenue

  const totalCashFlow = paidRevenue - transactions.filter(t => isTargetPeriod(t.due_date) && t.reconciled).reduce((s, t) => s + Number(t.amount), 0);

  // Cumulative Live Cash
  const liveCashBalance = new Array(numBuckets).fill(0);
  let runningCash = 0;
  for (let i = 0; i < numBuckets; i++) {
    runningCash += bucketCashFlow[i];
    liveCashBalance[i] = runningCash;
  }

  const topExpenses = Array.from(expenseCoaMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
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
    avgOrderValue,
    activeClientCount: activeClients.size,
    newClientCount,
    totalCogs,
    totalCost,
    totalSalary,
    totalCashFlow,
    totalAR,
    revenueVsCost: {
      labels,
      revenue: bucketRevenue,
      cost: bucketCost,
    },
    pnl: {
      labels,
      profit: bucketProfit,
    },
    liveCash: {
      labels,
      balance: liveCashBalance,
    },
    topExpenses,
    topClients,
    topProducts,
    availableYears: Array.from(yearsSeen).sort((a, b) => b - a),
    clientNames,
    year: currentYear,
    details,
    cards: buildCards(),
    companyOptions: combined ? undefined : companyOptions(),
  };

  function buildCards(): Record<CardKey, CardExtra> {
    const toSplit = (m: Map<string, number>, f: (code: string, v: number) => number = (_c, v) => v) =>
      Array.from(m.entries()).map(([code, v]) => ({ code, value: f(code, v) })).sort((a, b) => b.value - a.value);
    const months = monthFilter === null ? Math.max(1, monthsWithData) : 1;
    const orderSeries = bucketRevenue.map((v: number, i: number) => (bucketCount[i] ? v / bucketCount[i] : 0));
    return {
      revenue: { series: bucketRevenue, labels, split: toSplit(split.revenue) },
      paid: { series: bucketPaid, labels, split: toSplit(split.paid) },
      avgMonthly: { series: bucketRevenue, labels, split: toSplit(split.revenue, (_c, v) => v / months) },
      avgOrder: { series: orderSeries, labels, split: toSplit(split.revenue, (c, v) => (countByCode.get(c) ? v / (countByCode.get(c) as number) : 0)) },
      clients: { series: bucketClients.map((x) => x.size), labels, split: Array.from(clientsByCode.entries()).map(([code, set]) => ({ code, value: set.size })).sort((a, b) => b.value - a.value) },
      cogs: { series: bucketCogs, labels, split: toSplit(split.cogs) },
      cost: { series: bucketCost, labels, split: toSplit(split.cost) },
      salary: { series: bucketSalary, labels, split: toSplit(split.salary) },
      cash: { series: liveCashBalance, labels, split: toSplit(split.cash) },
      ar: { series: bucketAr, labels, split: toSplit(split.ar) },
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
