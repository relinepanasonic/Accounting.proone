const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('transactions').insert({
    workspace_id: '9bd0df1e-53c8-472e-8c31-9a74ea87d1df',
    description: 'Test Expense',
    amount: 100,
    due_date: '2026-01-01',
    is_upcoming_bill: true
  }).select();
  console.log(error);
}
run();
