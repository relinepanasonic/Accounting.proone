require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('workspace_id', wsId)
    .in('amount', [17700000, 10000000, -17700000, -10000000])
    .gte('transaction_date', '2026-06-01')
    .lte('transaction_date', '2026-06-30');

  console.log("Found in transactions:");
  txs.forEach(t => console.log(t.id, t.transaction_date, t.amount, t.bank_reference, t.reconciled));

  const { data: invs } = await supabase
    .from('invoices')
    .select('*')
    .in('amount_paid', [17700000, 10000000]);

  console.log("Found in invoices:");
  invs.forEach(i => console.log(i.id, i.issue_date, i.total_amount, i.amount_paid, i.bank_reference, i.reconciled));
}
run();
