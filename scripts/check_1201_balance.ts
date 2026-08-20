import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: workspaces } = await supabase.from('workspaces').select('id').eq('name', 'New Wave Live Specialist');
  const wId = workspaces[0].id;
  
  // Find all journal entries for 1201 in this workspace
  const { data: je } = await supabase.from('journal_entries').select('*').eq('workspace_id', wId).eq('account_code', '1201');
  console.log('Journal Entries:', JSON.stringify(je, null, 2));

  // Find all transactions for 1201
  const { data: tx } = await supabase.from('transactions').select('*').eq('workspace_id', wId).ilike('category', '1201%');
  console.log('Transactions:', JSON.stringify(tx, null, 2));
}
run();
