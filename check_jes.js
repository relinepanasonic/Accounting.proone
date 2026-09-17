require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  
  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, description, debit_amount, credit_amount, transaction_date')
    .eq('workspace_id', wsId)
    .ilike('description', '%BANK-REF%')
    .gte('transaction_date', '2026-06-01')
    .lte('transaction_date', '2026-06-30');

  console.log("Found in journal entries:");
  jes.forEach(j => console.log(j.description));
}
run();
