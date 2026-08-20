import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('global_chart_of_accounts').select('account_code, account_name, parent_code').or('account_code.like.5%,account_code.like.6%').order('account_code');
  console.log(JSON.stringify(data, null, 2));
}
run();
