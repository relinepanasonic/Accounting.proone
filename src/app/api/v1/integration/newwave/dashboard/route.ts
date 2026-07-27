import { NextResponse } from 'next/server';
import { authenticateApiRequest, corsHeaders, handleOptions } from '@/lib/api/cors';
import { createAdminClient, getNewwaveWorkspaceId } from '@/lib/api/supabase-admin';

export const OPTIONS = handleOptions;

export async function GET(request: Request) {
  try {
    if (!authenticateApiRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const supabase = createAdminClient();
    const workspaceId = await getNewwaveWorkspaceId(supabase);

    // Fetch Income (Paid Invoices)
    const { data: incomeData } = await supabase
      .from('invoices')
      .select('total_amount, status')
      .eq('workspace_id', workspaceId)
      .eq('status', 'paid');
    const totalIncome = incomeData?.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0) || 0;

    // Fetch Receivables (Pending Invoices)
    const { data: pendingData } = await supabase
      .from('invoices')
      .select('total_amount, status')
      .eq('workspace_id', workspaceId)
      .eq('status', 'draft');
    const totalReceivables = pendingData?.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0) || 0;

    // Fetch Expenses
    const { data: expensesData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('workspace_id', workspaceId)
      .eq('type', 'expense');
    const totalExpenses = expensesData?.reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        totalIncome,
        totalReceivables,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        metrics: {
          paidInvoicesCount: incomeData?.length || 0,
          pendingInvoicesCount: pendingData?.length || 0,
          expensesCount: expensesData?.length || 0,
        }
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
