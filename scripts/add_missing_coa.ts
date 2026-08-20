import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: workspaces } = await supabase.from('workspaces').select('id');
  const workspaceIds = workspaces.map(w => w.id);
  
  for (const wId of workspaceIds) {
    const assets = [
      { workspace_id: wId, account_code: '1201', account_name: 'Equipment & Hardware', account_type: 'ASSET', is_active: true, description: 'Capital equipment, computers, hardware' },
      { workspace_id: wId, account_code: '1202', account_name: 'Accumulated Depreciation', account_type: 'ASSET', is_active: true, description: 'Contra-asset for depreciation' },
      { workspace_id: wId, account_code: '1203', account_name: 'Furniture & Fixtures', account_type: 'ASSET', is_active: true, description: 'Office furniture' },
      { workspace_id: wId, account_code: '6100', account_name: 'Depreciation Expense', account_type: 'EXPENSE', is_active: true, description: 'Monthly depreciation expense' }
    ];
    
    // Check if 6100 exists
    const { data: existing6100 } = await supabase.from('global_chart_of_accounts').select('*').eq('workspace_id', wId).eq('account_code', '6100');
    let toInsert = assets;
    if (existing6100 && existing6100.length > 0) {
      toInsert = assets.filter(a => a.account_code !== '6100');
    }
    
    await supabase.from('global_chart_of_accounts').insert(toInsert);
  }
  console.log('Inserted missing COA accounts!');
}
run();
