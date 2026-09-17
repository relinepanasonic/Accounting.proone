require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, workspace_id, amount, description, bank_reference, created_at')
    .gte('transaction_date', '2026-06-01')
    .lte('transaction_date', '2026-06-30')
    .in('amount', [17700000, 10000000]);

  console.log("Found globally:", txs);
}
run();
