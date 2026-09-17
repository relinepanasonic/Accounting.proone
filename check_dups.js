require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('transaction_date', '2026-07-07')
    .ilike('description', '%Nico%');

  console.log("Found:", txs.length);
  txs.forEach(t => console.log(t.id, t.description, t.amount, t.bank_reference, t.created_at));
}
run();
