import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';

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
}

export interface DashboardTelemetryOptions {
  monthFilter?: number | null;
}

export async function getDashboardTelemetry(options: DashboardTelemetryOptions = {}): Promise<DashboardTelemetry> {
  const { monthFilter = null } = options;
  const supabase = await createClient();
  const { activeWorkspaceId, userEmail, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);
  const mask = clientMask({ userEmail, availableWorkspaces });

  const [invoicesRes, clientsRes, txRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, status, total_amount, issue_date, created_at, client_id, clients(name), invoice_line_items(package_name, description, amount, quantity)')
      .eq('workspace_id', activeWorkspaceId),
    supabase
      .from('clients')
      .select('id, name, created_at')
      .eq('workspace_id', activeWorkspaceId),
    supabase
      .from('transactions')
      .select('id, description, amount, due_date, category, reconciled')
      .eq('workspace_id', activeWorkspaceId)
  ]);

  const invoices = invoicesRes.data || [];
  const clients = clientsRes.data || [];
  const transactions = txRes.data || [];

  const currentYear = new Date().getFullYear();

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

  // Process Invoices
  for (const inv of invoices) {
    const d = inv.issue_date || inv.created_at;
    const amt = Number(inv.total_amount || 0);
    const st = (inv.status || 'draft').toLowerCase();

    // AR is all-time outstanding (pending, overdue, draft)
    if (['pending', 'overdue', 'draft'].includes(st)) {
      totalAR += amt;
    }

    if (!isTargetPeriod(d)) continue;
    if (st === 'cancelled') continue;

    totalRevenue += amt;
    invoiceCount++;
    const bIdx = getBucketIndex(d);
    if (bIdx !== -1) {
      bucketRevenue[bIdx] += amt;
      bucketProfit[bIdx] += amt; // Add revenue to profit
    }

    if (st === 'paid') {
      paidRevenue += amt;
      if (bIdx !== -1) bucketCashFlow[bIdx] += amt; // Cash in
    }

    if (inv.client_id) {
      activeClients.add(inv.client_id);
      const cName = mask(inv.client_id, inv.clients?.name);
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
  for (const c of clients) {
    if (isTargetPeriod(c.created_at)) {
      newClientCount++;
    }
  }

  // Expenses & Cash Out
  let totalCogs = 0;
  let totalCost = 0;
  let totalSalary = 0;
  const expenseCoaMap = new Map<string, number>();

  for (const tx of transactions) {
    const amt = Number(tx.amount || 0);
    const cat = (tx.category || '').toLowerCase();
    const d = tx.due_date;

    if (!isTargetPeriod(d)) continue;

    totalCost += amt;
    const bIdx = getBucketIndex(d);
    if (bIdx !== -1) {
      bucketCost[bIdx] += amt;
      bucketProfit[bIdx] -= amt; // Subtract cost from profit
    }

    if (tx.reconciled) {
      if (bIdx !== -1) bucketCashFlow[bIdx] -= amt; // Cash out
    }

    if (cat.includes('cogs') || cat.includes('cost of goods') || cat.includes('inventory')) {
      totalCogs += amt;
    } else if (cat.includes('salary') || cat.includes('payroll') || cat.includes('wages')) {
      totalSalary += amt;
    }

    const coaName = tx.category || 'Uncategorized';
    expenseCoaMap.set(coaName, (expenseCoaMap.get(coaName) || 0) + amt);
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
  };
}
