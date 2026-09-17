require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, transaction_date, amount, description, type')
    .eq('workspace_id', wsId)
    .ilike('description', '%Nico%');

  txs.filter(t => t.amount === 1000000).forEach(t => console.log(t));
}
run();
