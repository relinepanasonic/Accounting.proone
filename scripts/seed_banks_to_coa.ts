import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must use service role for full access

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Starting bank seeding...');

  const { data: workspaces, error: wErr } = await supabase.from('workspaces').select('*');
  if (wErr) throw wErr;

  const { data: bankAccounts, error: bErr } = await supabase.from('workspace_bank_accounts').select('*');
  if (bErr) throw bErr;

  let nextSubCode = 1001; // Start at 1001, since Cash is 1000

  // 1. Process regular workspace bank accounts
  for (const bank of (bankAccounts || [])) {
    const ws = workspaces?.find(w => w.id === bank.workspace_id);
    if (!ws) continue;

    const accountName = `${bank.bank_name} ${bank.account_number} (${bank.account_holder_name})`;
    const code = nextSubCode.toString();
    nextSubCode++;

    console.log(`Inserting: ${code} - ${accountName}`);

    const { error: insErr } = await supabase
      .from('global_chart_of_accounts')
      .upsert({
        account_code: code,
        account_name: accountName,
        account_type: 'Asset',
        parent_code: '1000',
        workspace_id: bank.workspace_id,
        is_active: bank.is_active,
        description: `Auto-migrated bank account for ${ws.name}`
      }, { onConflict: 'account_code' });

    if (insErr) console.error('Error inserting:', insErr);
  }

  // 2. Add requested explicit cash accounts
  const explicitCashAccounts = [
    { name: 'Cash New Wave', workspaceName: 'New Wave Live Specialist' },
    { name: 'Cash Prof Toko Online', workspaceName: 'Prof Toko Online' },
    { name: 'Cash PT Pintu Langit Inovasi Global', workspaceName: 'PT Pintu Langit Inovasi Global' }
  ];

  for (const acc of explicitCashAccounts) {
    const ws = workspaces?.find(w => w.name === acc.workspaceName);
    if (!ws) {
      console.warn(`Workspace not found for explicit account: ${acc.workspaceName}`);
      continue;
    }

    const code = nextSubCode.toString();
    nextSubCode++;

    console.log(`Inserting Explicit: ${code} - ${acc.name}`);

    const { error: insErr } = await supabase
      .from('global_chart_of_accounts')
      .upsert({
        account_code: code,
        account_name: acc.name,
        account_type: 'Asset',
        parent_code: '1000',
        workspace_id: ws.id,
        is_active: true,
        description: `Explicit Cash Account`
      }, { onConflict: 'account_code' });

    if (insErr) console.error('Error inserting:', insErr);
  }

  console.log('Seeding complete.');
}

run().catch(console.error);
