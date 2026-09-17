require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: clients } = await supabase.from('clients').select('id').limit(1);
  const { data: deals, error } = await supabase.from('crm_deals').select('id').limit(1);
  console.log('clients exists:', !!clients);
  console.log('crm_deals exists:', !!deals, error?.message);
}
run();
