require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: jes } = await supabase
    .from('journal_entries')
    .select('*')
    .ilike('description', '%INV-2026-965%');

  jes.forEach(j => console.log(j.transaction_date, j.debit_amount, j.credit_amount, j.description));
}
run();
