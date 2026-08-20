import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('global_chart_of_accounts').select('account_type');
  const types = [...new Set(data.map(d => d.account_type))];
  console.log(JSON.stringify(types));
}
run();
