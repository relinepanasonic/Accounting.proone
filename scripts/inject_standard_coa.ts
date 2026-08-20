import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STANDARD_ACCOUNTS = [
  // COGS
  { code: '5010', name: 'Direct Material Costs', type: 'COGS', parent: '5000' },
  { code: '5020', name: 'Direct Labor Costs', type: 'COGS', parent: '5000' },
  { code: '5030', name: 'Manufacturing Overhead', type: 'COGS', parent: '5000' },
  { code: '5040', name: 'Freight & Shipping Costs', type: 'COGS', parent: '5000' },
  { code: '5050', name: 'Subcontractor Costs', type: 'COGS', parent: '5000' },
  { code: '5060', name: 'Packaging & Supplies', type: 'COGS', parent: '5000' },
  // OPEX
  { code: '6010', name: 'Salaries, Wages & Benefits', type: 'EXPENSE', parent: '6000' },
  { code: '6020', name: 'Rent & Lease', type: 'EXPENSE', parent: '6000' },
  { code: '6030', name: 'Utilities & Telecommunications', type: 'EXPENSE', parent: '6000' },
  { code: '6040', name: 'Office Supplies & Expenses', type: 'EXPENSE', parent: '6000' },
  { code: '6050', name: 'Repairs & Maintenance', type: 'EXPENSE', parent: '6000' },
  { code: '6060', name: 'Insurance Expense', type: 'EXPENSE', parent: '6000' },
  { code: '6070', name: 'Professional Fees (Legal, Acc)', type: 'EXPENSE', parent: '6000' },
  { code: '6080', name: 'Advertising & Marketing', type: 'EXPENSE', parent: '6000' },
  { code: '6090', name: 'Travel, Meals & Entertainment', type: 'EXPENSE', parent: '6000' },
  { code: '6110', name: 'Bank Fees & Charges', type: 'EXPENSE', parent: '6000' },
  { code: '6120', name: 'Dues & Subscriptions', type: 'EXPENSE', parent: '6000' },
  { code: '6130', name: 'Depreciation & Amortization', type: 'EXPENSE', parent: '6000' },
  { code: '6140', name: 'Taxes & Licenses', type: 'EXPENSE', parent: '6000' },
  { code: '6150', name: 'Bad Debt Expense', type: 'EXPENSE', parent: '6000' },
  { code: '6160', name: 'Miscellaneous Expense', type: 'EXPENSE', parent: '6000' }
];

async function run() {
  const { data: workspaces } = await supabase.from('workspaces').select('id');
  
  for (const w of workspaces) {
    for (const acc of STANDARD_ACCOUNTS) {
      // Check if code exists to avoid duplicates
      const { data: existing } = await supabase.from('global_chart_of_accounts')
        .select('*')
        .eq('workspace_id', w.id)
        .eq('account_code', acc.code);
        
      if (!existing || existing.length === 0) {
        await supabase.from('global_chart_of_accounts').insert({
          workspace_id: w.id,
          account_code: acc.code,
          account_name: acc.name,
          account_type: acc.type,
          parent_code: acc.parent,
          is_active: true
        });
      }
    }
  }
  console.log('Standard international accounts injected.');
}
run();
