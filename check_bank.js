require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  
  const { data } = await supabase
    .from('workspace_bank_accounts')
    .select('id, bank_name, account_number')
    .eq('workspace_id', wsId);

  console.log(data);
}
run();
