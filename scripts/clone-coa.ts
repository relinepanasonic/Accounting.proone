import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1. Get all workspaces
  const { data: workspaces, error: wsErr } = await supabase.from('workspaces').select('id, name');
  if (wsErr) throw wsErr;
  
  console.log("Found workspaces:", workspaces.map(w => w.name));
  
  // 2. Find the primary workspace (Prof Toko Online) that has the COAs
  let sourceWorkspaceId = null;
  const { data: allAccounts, error: accErr } = await supabase.from('global_chart_of_accounts').select('*');
  if (accErr) throw accErr;
  
  console.log(`Found ${allAccounts.length} total COA accounts in DB.`);
  
  // Group by workspace
  const workspaceAccounts = {};
  for (const acc of allAccounts) {
    if (acc.workspace_id) {
      workspaceAccounts[acc.workspace_id] = (workspaceAccounts[acc.workspace_id] || 0) + 1;
    }
  }
  
  // Find workspace with most accounts
  let maxCount = 0;
  for (const [id, count] of Object.entries(workspaceAccounts)) {
    if (count > maxCount) {
      maxCount = count;
      sourceWorkspaceId = id;
    }
  }
  
  if (!sourceWorkspaceId) {
    console.log("No accounts with workspace_id found!");
    return;
  }
  
  const sourceName = workspaces.find(w => w.id === sourceWorkspaceId)?.name;
  console.log(`Source workspace: ${sourceName} (${maxCount} accounts)`);
  
  const sourceAccounts = allAccounts.filter(a => a.workspace_id === sourceWorkspaceId);
  
  // 3. For each other workspace, insert these accounts if they don't already have them
  for (const ws of workspaces) {
    if (ws.id === sourceWorkspaceId) continue;
    
    console.log(`Cloning to workspace: ${ws.name}...`);
    
    // Check if they already have accounts
    const existingCount = allAccounts.filter(a => a.workspace_id === ws.id).length;
    if (existingCount > 0) {
      console.log(` - Workspace ${ws.name} already has ${existingCount} accounts, skipping to avoid duplicates.`);
      continue;
    }
    
    const insertPayload = sourceAccounts.map(acc => ({
      account_code: acc.account_code,
      account_name: acc.account_name,
      account_type: acc.account_type,
      description: acc.description,
      parent_code: acc.parent_code,
      workspace_id: ws.id,
      is_active: acc.is_active
    }));
    
    const { error: insErr } = await supabase.from('global_chart_of_accounts').insert(insertPayload);
    if (insErr) {
      console.error(` - Error cloning to ${ws.name}:`, insErr);
    } else {
      console.log(` - Successfully cloned ${insertPayload.length} accounts to ${ws.name}`);
    }
  }
}

run().catch(console.error);
