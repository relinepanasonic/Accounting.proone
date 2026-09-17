require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: workspaces } = await supabase.from('workspaces').select('id, name').ilike('name', '%New Wave%');
  if (!workspaces || workspaces.length === 0) {
    console.log("No New Wave workspace found");
    return;
  }
  const wsId = workspaces[0].id;
  console.log("Workspace ID:", wsId);

  const { data: txs } = await supabase
    .from('transactions')
    .select('transaction_date, amount, description, reconciled')
    .eq('workspace_id', wsId)
    .gte('transaction_date', '2026-04-01')
    .lte('transaction_date', '2026-05-31');

  console.log("Total Transactions found in April-May:", txs.length);
  
  // Specific checks based on the PDF:
  // Apr 1: ERIC SETIAWAN +13,600,000
  // Apr 13: HERLAN TUNGGANA +1,750,000
  // Apr 25: NICO WINARTA +1,000,000
  // May 1: Nico +1,000,000
  // May 8: NICO +3,750,000
  // May 25: NICO +15,000,000

  const checks = [
    { date: '2026-04-01', amount: 13600000, desc: 'ERIC' },
    { date: '2026-04-13', amount: 1750000, desc: 'HERLAN' },
    { date: '2026-04-25', amount: 1000000, desc: 'Nico' },
    { date: '2026-05-01', amount: 1000000, desc: 'Nico' },
    { date: '2026-05-08', amount: 3750000, desc: 'NICO' },
    { date: '2026-05-25', amount: 15000000, desc: 'NICO' },
  ];

  checks.forEach(check => {
    const found = txs.filter(t => t.transaction_date === check.date && Math.abs(t.amount) === check.amount);
    console.log(`Check ${check.date} amount ${check.amount}: Found ${found.length} matches. Reconciled? ${found.map(f => f.reconciled).join(', ')}`);
  });
}
run();
