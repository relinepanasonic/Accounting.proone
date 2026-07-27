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

    // Fetch Journal Entries for the report summary
    const { data: journals, error } = await supabase
      .from('journal_entries')
      .select(`
        id, 
        entry_number, 
        entry_date, 
        description,
        journal_entry_lines(account_name, account_type, debit_amount, credit_amount)
      `)
      .eq('workspace_id', workspaceId)
      .order('entry_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ success: true, data: journals }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
