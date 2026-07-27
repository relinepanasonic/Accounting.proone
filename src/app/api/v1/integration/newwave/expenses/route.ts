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

    const { data: expenses, error } = await supabase
      .from('transactions')
      .select('id, category, amount, transaction_date, description, payment_method')
      .eq('workspace_id', workspaceId)
      .eq('type', 'expense')
      .order('transaction_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: expenses }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
