require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, workspace_id, transaction_date, amount, bank_reference, reconciled')
    .in('amount', [17700000, 10000000, -17700000, -10000000]);

  console.log("Found in transactions:", txs.length);
  txs.forEach(t => console.log(t));

  const { data: invs } = await supabase
    .from('invoices')
    .select('id, workspace_id, issue_date, total_amount, amount_paid, bank_reference, reconciled')
    .in('total_amount', [17700000, 10000000]);

  console.log("Found in invoices:", invs.length);
  invs.forEach(i => console.log(i));
}
run();
