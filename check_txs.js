require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, amount, description, bank_reference')
    .eq('workspace_id', wsId)
    .gte('transaction_date', '2026-06-01')
    .lte('transaction_date', '2026-06-30');

  console.log("All June txs:");
  txs.forEach(t => console.log(t.amount, t.description, t.bank_reference));
}
run();
