require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: invoices, error } = await supabase.from('invoices').select('id, status, total, amount_paid, client_id').limit(1);
  console.log("Invoices:", invoices, error);
}
check();
