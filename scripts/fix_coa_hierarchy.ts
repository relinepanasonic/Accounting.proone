import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: workspaces } = await supabase.from('workspaces').select('id');
  const workspaceIds = workspaces.map(w => w.id);
  
  for (const wId of workspaceIds) {
    // Check if 1200 exists
    const { data: existing1200 } = await supabase.from('global_chart_of_accounts').select('*').eq('workspace_id', wId).eq('account_code', '1200');
    if (!existing1200 || existing1200.length === 0) {
      await supabase.from('global_chart_of_accounts').insert({
        workspace_id: wId, 
        account_code: '1200', 
        account_name: 'Fixed Assets', 
        account_type: 'ASSET', 
        is_active: true, 
        description: 'Capital assets parent account'
      });
    }

    // Update 1201, 1202, 1203 to have parent_code '1200'
    await supabase.from('global_chart_of_accounts')
      .update({ parent_code: '1200' })
      .in('account_code', ['1201', '1202', '1203'])
      .eq('workspace_id', wId);
  }
  console.log('Successfully structured 1200 Fixed Assets hierarchy.');
}
run();
