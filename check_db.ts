import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: clients } = await supabase.from('clients').select('id').limit(1);
  const { data: data1, error: err1 } = await supabase.from('invoices').insert({ workspace_id: '11111111-1111-1111-1111-111111111111', client_id: clients![0].id, invoice_number: '', issue_date: '2026-01-01', due_date: '2026-01-01' }).select();
  const { data: data2, error: err2 } = await supabase.from('invoices').insert({ workspace_id: '11111111-1111-1111-1111-111111111111', client_id: clients![0].id, invoice_number: '', issue_date: '2026-01-01', due_date: '2026-01-01' }).select();
  console.log(err2);
  if (data1) await supabase.from('invoices').delete().eq('id', data1[0].id);
  if (data2) await supabase.from('invoices').delete().eq('id', data2[0].id);
}
run();
