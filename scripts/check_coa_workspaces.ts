import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: workspaces } = await supabase.from('workspaces').select('id, name');
  for (const w of workspaces) {
    const { data: coa } = await supabase.from('global_chart_of_accounts').select('account_code').eq('workspace_id', w.id).in('account_code', ['1201','1202','1203']);
    console.log('Workspace', w.name, 'has', coa.map(c => c.account_code).join(', '));
  }
}
run();
