import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  await supabase.from('global_chart_of_accounts').update({ account_type: 'Asset' }).eq('account_type', 'ASSET');
  await supabase.from('global_chart_of_accounts').update({ account_type: 'Expense' }).eq('account_type', 'EXPENSE');
  await supabase.from('global_chart_of_accounts').update({ account_type: 'Liability' }).eq('account_type', 'LIABILITY');
  await supabase.from('global_chart_of_accounts').update({ account_type: 'Equity' }).eq('account_type', 'EQUITY');
  await supabase.from('global_chart_of_accounts').update({ account_type: 'Revenue' }).eq('account_type', 'REVENUE');
  await supabase.from('global_chart_of_accounts').update({ account_type: 'COGS' }).eq('account_type', 'cogs');
  console.log('Fixed account types casing!');
}
run();
