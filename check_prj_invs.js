require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: invs } = await supabase
    .from('invoices')
    .select('id, workspace_id, invoice_number, total_amount, amount_paid, bank_reference, reconciled, issue_date')
    .ilike('notes', '%PRJ%');

  console.log("Found PRJ invoices via notes:", invs);

  const { data: invs2 } = await supabase
    .from('invoices')
    .select('id, workspace_id, invoice_number, total_amount, amount_paid, bank_reference, reconciled, issue_date')
    .ilike('invoice_number', '%PRJ%');

  console.log("Found PRJ invoices via number:", invs2);
}
run();
