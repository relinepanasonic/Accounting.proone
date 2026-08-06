import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Test 1: Fetch mappings
    const { data: mappings } = await supabase.from('workspace_ledger_mappings').select('*').eq('workspace_id', 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3');
    
    // Test 2: Fetch bank accounts
    const { data: banks } = await supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3');
    
    // Test 3: Insert test journal entry
    const { error: jeErr1 } = await supabase.from('journal_entries').insert([
        { workspace_id: 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3', account_code: '1000', transaction_date: '2026-08-06', debit_amount: 100, credit_amount: 0, description: 'Test', reference_id: 'd861d85f-8f81-420a-8d14-3687be696c21', reference_type: 'payment' }
    ]);
    const { error: jeErr2 } = await supabase.from('journal_entries').insert([
        { workspace_id: 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3', account_code: '1200', transaction_date: '2026-08-06', debit_amount: 0, credit_amount: 100, description: 'Test', reference_id: 'd861d85f-8f81-420a-8d14-3687be696c21', reference_type: 'payment' }
    ]);
    
    return NextResponse.json({ mappings, banks, jeErr1: jeErr1, jeErr2: jeErr2 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
