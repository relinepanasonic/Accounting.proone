require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const wsId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  
  const { data: txs } = await supabase
    .from('transactions')
    .select('transaction_date, amount, description, reconciled')
    .eq('workspace_id', wsId)
    .gte('transaction_date', '2026-04-01')
    .lte('transaction_date', '2026-05-31');

  // Let's dump all missing dates
  const checkDates = ['2026-04-01', '2026-04-13', '2026-05-08'];
  checkDates.forEach(d => {
     console.log(`--- Transactions on ${d} ---`);
     const filtered = txs.filter(t => t.transaction_date === d);
     console.log(filtered);
  });
}
run();
