import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { formatIndoDate } from '@/lib/utils';

export interface DashboardTelemetry {
  totalRevenue: number;
  totalSales: number;
  avgOrderValue: number;
  newCustomersCount: number;
  customerOutCount: number;

  salesVsPaid: {
    months: string[];
    issued: number[];
    paid: number[];
  };
  topProducts: Array<{ name: string; amount: number }>;

  costs: {
    months: string[];
    cogs: number[];
    general: number[];
  };
  bankBalance: {
    months: string[];
    balance: number[];
  };

  accountsPayable: number;
  accountsReceivable: number;
  netCashFlow: number;

  clientMetrics: Array<{
    id: string;
    name: string;
    joinSince: string;
    totalInvoices: number;
    totalPaid: number;
    ar: number;
    status: 'Healthy' | 'Debt' | 'Out';
  }>;
}

/**
 * Concurrent, zero-waterfall server-side telemetry fetcher.
 * Uses Promise.all to fetch Invoices, Clients, Bills, and Fixed Assets simultaneously.
 */
export async function getDashboardTelemetry(): Promise<DashboardTelemetry> {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Concurrent Execution via Promise.all (Anti-Waterfall Guardrail)
  const [invoicesRes, clientsRes, billsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, due_date, issue_date, client_id, clients(name), invoice_line_items(package_name, description, amount)')
      .or(`workspace_id.eq.${activeWorkspaceId},assigned_workspace_id.eq.${activeWorkspaceId}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, name, created_at')
      .eq('workspace_id', activeWorkspaceId),
    supabase
      .from('transactions')
      .select('id, description, amount, due_date, status, category, is_upcoming_bill')
      .eq('workspace_id', activeWorkspaceId)
  ]);

  const invoices = invoicesRes.data || [];
  const clients = clientsRes.data || [];
  const transactions = billsRes.data || [];

  const currentYear = 2026;

  // Helper to map a date to an index (0-11) where 0 is Jan, 11 is Dec of currentYear
  const getMonthOffset = (dateStr: string | null) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    if (d.getFullYear() === currentYear) {
      return d.getMonth();
    }
    return -1;
  };

  const chartMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // --- 1. Top Stats (Numbers) & Top Products ---
  let totalRevenue = 0; 
  let totalSales = 0;   
  let paidInvoicesCount = 0;
  
  const issuedByMonth = new Array(12).fill(0);
  const paidByMonth = new Array(12).fill(0);

  let accountsReceivable = 0;
  const productSales = new Map<string, number>();

  // Process Invoices
  for (const inv of invoices) {
    const d = new Date(inv.issue_date || inv.created_at);
    const isCurrentYear = d.getFullYear() === currentYear;
    
    const amt = Number(inv.total_amount || 0);
    const st = (inv.status || 'draft').toLowerCase();
    
    // Only count current year invoices for Revenue and Sales
    if (isCurrentYear) {
      if (st !== 'cancelled') {
        totalRevenue += amt;
        const idx = getMonthOffset(inv.issue_date || inv.created_at);
        if (idx !== -1) issuedByMonth[idx] += amt;
        
        // Accumulate Top Products for current year non-cancelled invoices
        if (Array.isArray(inv.invoice_line_items)) {
          for (const item of inv.invoice_line_items) {
            const itemAmt = Number(item.amount || 0);
            const name = item.package_name || item.description || 'Unknown Item';
            productSales.set(name, (productSales.get(name) || 0) + itemAmt);
          }
        }
      }

      if (st === 'paid') {
        totalSales += amt;
        paidInvoicesCount++;
        const idx = getMonthOffset(inv.issue_date || inv.created_at);
        if (idx !== -1) paidByMonth[idx] += amt;
      }
    }

    // AR includes ALL TIME pending/draft/overdue
    if (st === 'pending' || st === 'overdue' || st === 'draft') {
      accountsReceivable += amt;
    }
  }

  const avgOrderValue = paidInvoicesCount > 0 ? totalSales / paidInvoicesCount : 0;

  // Process Clients for New vs Out
  let newCustomersCount = 0;
  let customerOutCount = 0;
  
  // Find last activity per client
  const clientLastActivity = new Map<string, Date>();
  for (const inv of invoices) {
    const cid = inv.client_id;
    if (!cid) continue;
    const d = new Date(inv.issue_date || inv.created_at);
    const existing = clientLastActivity.get(cid);
    if (!existing || d > existing) {
      clientLastActivity.set(cid, d);
    }
  }

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (const c of clients) {
    const createdDate = new Date(c.created_at);
    if (createdDate.getMonth() === currentMonthIdx && createdDate.getFullYear() === currentYear) {
      newCustomersCount++;
    }
    
    const lastActive = clientLastActivity.get(c.id);
    if (!lastActive || lastActive < threeMonthsAgo) {
      customerOutCount++;
    }
  }

  const topProducts = Array.from(productSales.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // --- 3. Costs vs COGS & Cash Flow ---
  const cogsByMonth = new Array(12).fill(0);
  const genByMonth = new Array(12).fill(0);
  let accountsPayable = 0;
  let netCashFlow = 0; // Total Paid Invoices - Total Paid Transactions (all time or just active balance, we'll do all time)

  const bankBalanceByMonth = new Array(12).fill(0);

  // We will build running balance up to current month.
  // First, sum everything before the currentYear as starting balance
  let startingBalance = 0;

  for (const inv of invoices) {
    if ((inv.status || '').toLowerCase() === 'paid') {
      const idx = getMonthOffset(inv.issue_date || inv.created_at);
      const amt = Number(inv.total_amount || 0);
      if (idx === -1) {
        // before current year
        const d = new Date(inv.issue_date || inv.created_at);
        if (d.getFullYear() < currentYear) {
          startingBalance += amt;
        }
      } else {
        bankBalanceByMonth[idx] += amt;
      }
      netCashFlow += amt;
    }
  }

  for (const tx of transactions) {
    const amt = Number(tx.amount || 0);
    const st = (tx.status || 'pending').toLowerCase();
    const cat = (tx.category || '').toLowerCase();
    
    if (st === 'pending' && tx.is_upcoming_bill) {
      accountsPayable += amt;
    }

    if (st === 'paid') {
      netCashFlow -= amt;
      const idx = getMonthOffset(tx.due_date);
      
      if (idx === -1) {
        const d = new Date(tx.due_date);
        if (d.getFullYear() < currentYear) {
          startingBalance -= amt;
        }
      } else {
        bankBalanceByMonth[idx] -= amt; // outflows decrease balance
        if (cat.includes('cogs') || cat.includes('inventory') || cat.includes('cost of goods')) {
          cogsByMonth[idx] += amt;
        } else {
          genByMonth[idx] += amt;
        }
      }
    }
  }

  // Accumulate Running Bank Balance
  let runningBal = startingBalance;
  for (let i = 0; i < 12; i++) {
    runningBal += bankBalanceByMonth[i];
    bankBalanceByMonth[i] = runningBal;
  }

  // --- 4. Client Metrics Table ---
  const clientMetricsMap = new Map<string, any>();
  for (const c of clients) {
    clientMetricsMap.set(c.id, {
      id: c.id,
      name: c.name,
      joinSince: formatIndoDate(c.created_at),
      totalInvoices: 0,
      totalPaid: 0,
      ar: 0,
      status: 'Healthy'
    });
  }

  for (const inv of invoices) {
    const cid = inv.client_id;
    if (!cid) continue;
    const m = clientMetricsMap.get(cid);
    if (!m) continue;

    const amt = Number(inv.total_amount || 0);
    const st = (inv.status || 'draft').toLowerCase();

    if (st !== 'draft') m.totalInvoices++;
    if (st === 'paid') m.totalPaid += amt;
    if (st === 'pending' || st === 'overdue') m.ar += amt;
  }

  const clientMetrics = Array.from(clientMetricsMap.values()).map(m => {
    const lastActive = clientLastActivity.get(m.id);
    if (!lastActive || lastActive < threeMonthsAgo) {
      m.status = 'Out';
    } else if (m.ar > 0) {
      // Find if they have any overdue
      const hasOverdue = invoices.some(i => i.client_id === m.id && (i.status || '').toLowerCase() === 'overdue');
      if (hasOverdue) m.status = 'Debt';
    }
    return m;
  }).sort((a, b) => b.totalPaid - a.totalPaid);

  return {
    totalRevenue,
    totalSales,
    avgOrderValue,
    newCustomersCount,
    customerOutCount,
    
    salesVsPaid: {
      months: chartMonths,
      issued: issuedByMonth,
      paid: paidByMonth
    },
    topProducts,
    
    costs: {
      months: chartMonths,
      cogs: cogsByMonth,
      general: genByMonth
    },
    bankBalance: {
      months: chartMonths,
      balance: bankBalanceByMonth
    },

    accountsPayable,
    accountsReceivable,
    netCashFlow,

    clientMetrics
  };
}
