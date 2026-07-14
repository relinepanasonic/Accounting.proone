import 'server-only';
import { createClient } from '@/lib/supabase/server';

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
}

/**
 * Concurrent, zero-waterfall server-side telemetry fetcher.
 * Uses Promise.all to fetch Invoices, Clients, Bills, and Fixed Assets simultaneously.
 */
export async function getDashboardTelemetry(): Promise<DashboardTelemetry> {
  const supabase = await createClient();

  // Concurrent Execution via Promise.all (Anti-Waterfall Guardrail)
  const [invoicesRes, clientsRes, billsRes, assetsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, due_date, client_id, clients(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, name')
      .limit(10),
    supabase
      .from('transactions')
      .select('id, description, amount, due_date')
      .eq('is_upcoming_bill', true)
      .order('due_date', { ascending: true })
      .limit(8),
    supabase
      .from('fixed_assets')
      .select('initial_value, salvage_value, useful_life_years, purchase_date, status')
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
      dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '15/07/2026',
      status: (st === 'overdue' ? 'Overdue' : st === 'paid' ? 'Paid' : 'Pending') as 'Paid' | 'Overdue',
    };
  });

  const upcomingBills = (billsRes.data || []).map((b) => ({
    vendor: b.description || 'Vendor Payee',
    amount: `Rp ${Number(b.amount || 0).toLocaleString('id-ID')}`,
    dueDate: b.due_date ? new Date(b.due_date).toLocaleDateString('id-ID') : '15/07/2026',
  }));

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
  };
}
