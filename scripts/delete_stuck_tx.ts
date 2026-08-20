import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const txId = 'e3a798d6-40a8-47fb-a92c-4977aaa14bfd';
  console.log('Deleting transaction', txId);
  await supabase.from('journal_entries').delete().eq('reference_id', txId);
  await supabase.from('transactions').delete().eq('id', txId);
  console.log('Deleted successfully.');
}
run();
