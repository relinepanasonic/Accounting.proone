require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, amount_paid, bank_reference, clients(name)')
    .or(`workspace_id.eq.${wsId},assigned_workspace_id.eq.${wsId}`)
    .gte('issue_date', '2026-05-01');

  console.log("June/May Invoices:", invs);
}
run();
