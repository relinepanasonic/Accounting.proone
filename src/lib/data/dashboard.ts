import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { formatIndoDate } from '@/lib/utils';

export interface DashboardTelemetry {
  invoicesSummary: {
    totalVolume: number;
    overdueCount: number;
    paidCount: number;
    avgInvoiceAmount: number;
    unpaidRatio: number; // percentage display
    activeReceivables: number;
    totalRevenue: number;
    totalAssetsBookValue: number;
  };
  clientReceivables: Array<{
    name: string;
    count: number;
    owed: string;
    status: 'cyan' | 'copper';
  }>;
  invoicesList: Array<{
    id: string;
    client: string;
    amount: string;
    dueDate: string;
    status: 'Paid' | 'Overdue';
  }>;
  upcomingBills: Array<{
    vendor: string;
    amount: string;
    dueDate: string;
  }>;
  chartData: {
    months: string[];
    revenue: number[];
    expenses: number[];
    depreciation: number[];
    projectedCurrentMonth: number;
    projectedTarget: number;
    projectedPercentChange: number;
    expenseCategories: Array<{ category: string; amount: number }>;
    collectionHealthScore: number;
  };
}

/**
 * Concurrent, zero-waterfall server-side telemetry fetcher.
 * Uses Promise.all to fetch Invoices, Clients, Bills, and Fixed Assets simultaneously.
 */
export async function getDashboardTelemetry(): Promise<DashboardTelemetry> {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Concurrent Execution via Promise.all (Anti-Waterfall Guardrail)
  const [invoicesRes, clientsRes, billsRes, assetsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, due_date, client_id, clients(name)')
      .or(`workspace_id.eq.${activeWorkspaceId},assigned_workspace_id.eq.${activeWorkspaceId}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, name')
      .eq('workspace_id', activeWorkspaceId)
      .limit(10),
    supabase
      .from('transactions')
      .select('id, description, amount, due_date, status, category, is_upcoming_bill')
      .eq('workspace_id', activeWorkspaceId),
    supabase
      .from('fixed_assets')
      .select('initial_value, salvage_value, useful_life_years, purchase_date, status')
      .eq('workspace_id', activeWorkspaceId)
      .eq('status', 'active'),
  ]);

  const invoices = invoicesRes.data || [];
  const assets = assetsRes.data || [];

  // Calculate Fixed Assets straight-line Current Book Value sum
  const nowMs = Date.now();
  let totalAssetsBookValue = 0;

  for (const asset of assets) {
    const initialVal = Number(asset.initial_value || 0);
    const salvageVal = Number(asset.salvage_value || 0);
    const lifeYears = Number(asset.useful_life_years || 3);
    const annualDeprec = (initialVal - salvageVal) / (lifeYears > 0 ? lifeYears : 1);

    const purchaseDateMs = new Date(asset.purchase_date).getTime() || nowMs;
    const yearsPassedRaw = (nowMs - purchaseDateMs) / (365.25 * 24 * 3600 * 1000);
    const yearsPassed = Math.min(lifeYears, Math.max(0, yearsPassedRaw));

    const currentBookValue = Math.max(salvageVal, initialVal - annualDeprec * yearsPassed);
    totalAssetsBookValue += currentBookValue;
  }

  // Calculate Live Revenue & Active Receivables
  let activeReceivables = 0;
  let totalRevenue = 0;
  let overdueCount = 0;
  let paidCount = 0;

  for (const inv of invoices) {
    const amt = Number(inv.total_amount || 0);
    const st = (inv.status || 'draft').toLowerCase();

    if (st === 'draft' || st === 'overdue') {
      activeReceivables += amt;
    }
    if (st === 'paid') {
      totalRevenue += amt;
      paidCount++;
    }
    if (st === 'overdue') {
      overdueCount++;
    }
  }

  const totalVolume = activeReceivables + totalRevenue;

  // Transform live Supabase data into telemetry structures (or return clean empty states if zero rows)
  const clientReceivablesMap = new Map<string, { count: number; owed: number }>();
  for (const inv of invoices) {
    const st = (inv.status || 'draft').toLowerCase();
    if (st === 'draft' || st === 'overdue' || st === 'pending') {
      const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      const name = clientObj?.name || 'Unknown Client';
      const amt = Number(inv.total_amount || 0);
      const existing = clientReceivablesMap.get(name) || { count: 0, owed: 0 };
      clientReceivablesMap.set(name, { count: existing.count + 1, owed: existing.owed + amt });
    }
  }

  const clientReceivables = Array.from(clientReceivablesMap.entries()).map(([name, data], i) => ({
    name,
    count: data.count,
    owed: `Rp ${data.owed.toLocaleString('id-ID')}`,
    status: (i % 2 === 0 ? 'cyan' : 'copper') as 'cyan' | 'copper',
  }));

  const invoicesList = invoices.slice(0, 10).map((inv) => {
    const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    const clientName = clientObj?.name || 'Client';
    const st = (inv.status || 'draft').toLowerCase();
    return {
      id: inv.invoice_number || 'INV-REF',
      client: clientName,
      amount: `Rp ${Number(inv.total_amount || 0).toLocaleString('id-ID')}`,
      dueDate: formatIndoDate(inv.due_date),
      status: (st === 'overdue' ? 'Overdue' : st === 'paid' ? 'Paid' : 'Pending') as 'Paid' | 'Overdue',
    };
  });

  // Advanced Aggregation for Charts
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  // Generate last 9 months labels
  const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartMonths: string[] = [];
  for (let i = 8; i >= 0; i--) {
    let m = currentMonthIdx - i;
    if (m < 0) m += 12;
    chartMonths.push(monthsList[m]);
  }

  // Initialize data arrays
  const revByMonth = new Array(9).fill(0);
  const expByMonth = new Array(9).fill(0);
  const depByMonth = new Array(9).fill(0);

  const getMonthOffset = (dateStr: string | null) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    const mDiff = (currentYear - d.getFullYear()) * 12 + (currentMonthIdx - d.getMonth());
    return mDiff >= 0 && mDiff < 9 ? 8 - mDiff : -1; // index in 9-element array
  };

  // 1. Revenue
  let projectedCurrentMonth = 0;
  for (const inv of invoices) {
    const amt = Number(inv.total_amount || 0);
    const st = (inv.status || 'draft').toLowerCase();
    
    // Group paid revenue by month
    if (st === 'paid') {
      const idx = getMonthOffset(inv.issue_date);
      if (idx !== -1) revByMonth[idx] += amt;
    }

    // Add pending invoices of current month to projection
    if (st === 'pending' || st === 'draft' || st === 'overdue') {
      const d = new Date(inv.issue_date);
      if (d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear) {
        projectedCurrentMonth += amt;
      }
    }
  }
  // Add already paid this month to projection
  projectedCurrentMonth += revByMonth[8];

  // 2. Expenses
  const allTransactions = billsRes.data || [];
  const expCategoryMap = new Map<string, number>();

  for (const tx of allTransactions) {
    const amt = Number(tx.amount || 0);
    // Add to monthly expenses if paid
    if ((tx.status || 'pending').toLowerCase() === 'paid') {
      const idx = getMonthOffset(tx.due_date);
      if (idx !== -1) expByMonth[idx] += amt;
      
      const cat = tx.category || 'General';
      expCategoryMap.set(cat, (expCategoryMap.get(cat) || 0) + amt);
    }
  }

  // Calculate Asset Depreciation across the months
  for (const asset of assets) {
    const initialVal = Number(asset.initial_value || 0);
    const salvageVal = Number(asset.salvage_value || 0);
    const lifeYears = Number(asset.useful_life_years || 3);
    const monthlyDeprec = (initialVal - salvageVal) / ((lifeYears > 0 ? lifeYears : 1) * 12);

    const purchaseDate = new Date(asset.purchase_date);
    for (let i = 0; i < 9; i++) {
      let m = currentMonthIdx - (8 - i);
      let y = currentYear;
      if (m < 0) {
        m += 12;
        y -= 1;
      }
      const checkDate = new Date(y, m);
      if (checkDate >= purchaseDate) {
        depByMonth[i] += monthlyDeprec;
      }
    }
  }

  const upcomingBills = allTransactions
    .filter(tx => tx.is_upcoming_bill && (tx.status || 'pending').toLowerCase() !== 'paid')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 8)
    .map(b => ({
      vendor: b.description || 'Vendor Payee',
      amount: `Rp ${Number(b.amount || 0).toLocaleString('id-ID')}`,
      dueDate: formatIndoDate(b.due_date),
    }));

  const expenseCategories = Array.from(expCategoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Collection Health (0-100)
  const healthScore = totalVolume > 0 ? Math.min(100, Math.round((paidCount / invoices.length) * 100)) : 100;
  
  // Projection Target
  const prevMonthRevenue = revByMonth[7] || 0;
  const projectedTarget = prevMonthRevenue > 0 ? prevMonthRevenue * 1.1 : 10000000;
  const projectedPercentChange = prevMonthRevenue > 0 ? ((projectedCurrentMonth - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  return {
    invoicesSummary: {
      totalVolume,
      overdueCount,
      paidCount,
      avgInvoiceAmount: invoices.length > 0 ? totalVolume / invoices.length : 0,
      unpaidRatio: totalVolume > 0 ? Math.round((activeReceivables / totalVolume) * 100) : 0,
      activeReceivables,
      totalRevenue,
      totalAssetsBookValue,
    },
    clientReceivables,
    invoicesList,
    upcomingBills,
    chartData: {
      months: chartMonths,
      revenue: revByMonth,
      expenses: expByMonth,
      depreciation: depByMonth,
      projectedCurrentMonth,
      projectedTarget,
      projectedPercentChange,
      expenseCategories,
      collectionHealthScore: healthScore
    }
  };
}
