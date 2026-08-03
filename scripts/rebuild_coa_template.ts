import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEMPLATE = [
  // ASSETS
  { code: '1000', name: 'Current Assets', type: 'Asset', parent: null },
  { code: '1001', name: 'Petty Cash', type: 'Asset', parent: '1000' },
  { code: '1002', name: 'Accounts Receivable', type: 'Asset', parent: '1000' },
  { code: '1003', name: 'Inventory', type: 'Asset', parent: '1000' },
  { code: '1004', name: 'Unrealized Gain on Foreign Currency', type: 'Asset', parent: '1000' },

  { code: '1100', name: 'Non Current Assets', type: 'Asset', parent: null },
  { code: '1101', name: 'Investments - Long Term', type: 'Asset', parent: '1100' },
  { code: '1102', name: 'Goodwill', type: 'Asset', parent: '1100' },

  { code: '1200', name: 'Fixed Assets', type: 'Asset', parent: null },
  { code: '1201', name: 'Office Equipment', type: 'Asset', parent: '1200' },
  { code: '1202', name: 'Motor Vehicle', type: 'Asset', parent: '1200' },
  { code: '1203', name: 'Buildings', type: 'Asset', parent: '1200' },
  { code: '1204', name: 'Machinery', type: 'Asset', parent: '1200' },

  // LIABILITIES
  { code: '2000', name: 'Current Liabilities', type: 'Liability', parent: null },
  { code: '2001', name: 'Credit Card', type: 'Liability', parent: '2000' },
  { code: '2002', name: 'Accounts Payable', type: 'Liability', parent: '2000' },
  { code: '2003', name: 'Unrealized Loss on Foreign Currency', type: 'Liability', parent: '2000' },
  { code: '2004', name: 'Income Tax Payable', type: 'Liability', parent: '2000' },
  { code: '2005', name: 'Payroll Taxes', type: 'Liability', parent: '2000' },

  { code: '2100', name: 'Non-Current Liabilities', type: 'Liability', parent: null },
  { code: '2101', name: 'Bank Loan', type: 'Liability', parent: '2100' },
  { code: '2102', name: 'Vehicle Loan', type: 'Liability', parent: '2100' },

  // EQUITY
  { code: '3000', name: 'Equity', type: 'Equity', parent: null },
  { code: '3001', name: 'Capital', type: 'Equity', parent: '3000' },
  { code: '3002', name: 'Drawings', type: 'Equity', parent: '3000' },
  { code: '3003', name: 'Current Year Earnings', type: 'Equity', parent: '3000' },
  { code: '3004', name: 'Retained Earnings', type: 'Equity', parent: '3000' },

  // INCOME (Revenue)
  { code: '4000', name: 'Income', type: 'Revenue', parent: null },
  { code: '4001', name: 'Sales', type: 'Revenue', parent: '4000' },
  { code: '4002', name: 'Labour', type: 'Revenue', parent: '4000' },
  { code: '4003', name: 'Materials', type: 'Revenue', parent: '4000' },
  { code: '4004', name: 'Consulting Fees', type: 'Revenue', parent: '4000' },
  { code: '4005', name: 'Freight', type: 'Revenue', parent: '4000' },
  { code: '4006', name: 'Commissions Received', type: 'Revenue', parent: '4000' },
  { code: '4007', name: 'Gain on Foreign Exchange', type: 'Revenue', parent: '4000' },

  { code: '4100', name: 'Other Income', type: 'Revenue', parent: null },
  { code: '4101', name: 'Bank Interest Income', type: 'Revenue', parent: '4100' },

  // COST OF SALES (Expense)
  { code: '5000', name: 'Cost of Sales | Goods Sold', type: 'Expense', parent: null },
  { code: '5001', name: 'Labour', type: 'Expense', parent: '5000' },
  { code: '5002', name: 'Materials', type: 'Expense', parent: '5000' },
  { code: '5003', name: 'Parts or Products', type: 'Expense', parent: '5000' },
  { code: '5004', name: 'Contractors', type: 'Expense', parent: '5000' },
  { code: '5005', name: 'Freight & Shipping', type: 'Expense', parent: '5000' },
  { code: '5006', name: 'Discounts Given', type: 'Expense', parent: '5000' },
  { code: '5007', name: 'Other', type: 'Expense', parent: '5000' },

  // EXPENSES
  { code: '6000', name: 'Expenses', type: 'Expense', parent: null },
  { code: '6001', name: 'Advertising & Promotion', type: 'Expense', parent: '6000' },
  { code: '6002', name: 'Bad debts', type: 'Expense', parent: '6000' },
  { code: '6003', name: 'Bank Fees & Charges', type: 'Expense', parent: '6000' },
  { code: '6004', name: 'Consulting | Contractor Fees', type: 'Expense', parent: '6000' },
  { code: '6005', name: 'Depreciation', type: 'Expense', parent: '6000' },
  { code: '6006', name: 'Entertainment Costs', type: 'Expense', parent: '6000' },
  { code: '6007', name: 'Furnishings & Fixtures', type: 'Expense', parent: '6000' },
  { code: '6008', name: 'Home Office Expenses', type: 'Expense', parent: '6000' },
  { code: '6009', name: 'Insurance - Business', type: 'Expense', parent: '6000' },
  
  { code: '6010', name: 'Lease Hire', type: 'Expense', parent: '6000' },
  { code: '6011', name: 'Office Equipment', type: 'Expense', parent: '6010' },
  { code: '6012', name: 'Vehicle', type: 'Expense', parent: '6010' },
  { code: '6013', name: 'Machinery', type: 'Expense', parent: '6010' },

  { code: '6014', name: 'Loss on Foreign Exchange', type: 'Expense', parent: '6000' },
  { code: '6015', name: 'Marketing', type: 'Expense', parent: '6000' },
  { code: '6016', name: 'Merchant Fees & Charges', type: 'Expense', parent: '6000' },
  
  { code: '6017', name: 'Office Expenses', type: 'Expense', parent: '6000' },
  { code: '6018', name: 'Courier | Shipping', type: 'Expense', parent: '6017' },
  { code: '6019', name: 'Equipment', type: 'Expense', parent: '6017' },
  { code: '6020', name: 'Other', type: 'Expense', parent: '6017' },

  { code: '6021', name: 'Packaging', type: 'Expense', parent: '6000' },
  { code: '6022', name: 'Postage', type: 'Expense', parent: '6000' },
  { code: '6023', name: 'Printing', type: 'Expense', parent: '6000' },
  { code: '6024', name: 'Software', type: 'Expense', parent: '6000' },
  { code: '6025', name: 'Stationery', type: 'Expense', parent: '6000' },
  
  { code: '6026', name: 'Online Services', type: 'Expense', parent: '6000' },
  { code: '6027', name: 'Cloud Storage', type: 'Expense', parent: '6026' },
  { code: '6028', name: 'Email', type: 'Expense', parent: '6026' },
  { code: '6029', name: 'Other Applications', type: 'Expense', parent: '6026' },

  { code: '6030', name: 'Payroll Expenses', type: 'Expense', parent: '6000' },
  
  { code: '6031', name: 'Professional Fees', type: 'Expense', parent: '6000' },
  { code: '6032', name: 'Accountancy', type: 'Expense', parent: '6031' },
  { code: '6033', name: 'Legal', type: 'Expense', parent: '6031' },

  { code: '6034', name: 'Reference Materials', type: 'Expense', parent: '6000' },
  
  { code: '6035', name: 'Rent', type: 'Expense', parent: '6000' },
  { code: '6036', name: 'Office Space', type: 'Expense', parent: '6035' },
  { code: '6037', name: 'Workshop', type: 'Expense', parent: '6035' },
  { code: '6038', name: 'Storage', type: 'Expense', parent: '6035' },

  { code: '6039', name: 'Security', type: 'Expense', parent: '6000' },
  { code: '6040', name: 'Subscriptions', type: 'Expense', parent: '6000' },
  { code: '6041', name: 'Training & Development', type: 'Expense', parent: '6000' },
  { code: '6042', name: 'Travel and Accommodation', type: 'Expense', parent: '6000' },
  
  { code: '6043', name: 'Utilities', type: 'Expense', parent: '6000' },
  { code: '6044', name: 'Gas & Electrical', type: 'Expense', parent: '6043' },
  { code: '6045', name: 'Broadband', type: 'Expense', parent: '6043' },
  { code: '6046', name: 'Phone', type: 'Expense', parent: '6043' },

  { code: '6047', name: 'Vehicle Expenses', type: 'Expense', parent: '6000' },
  { code: '6048', name: 'Gas | Fuel', type: 'Expense', parent: '6047' },
  { code: '6049', name: 'Repairs and Maintenance', type: 'Expense', parent: '6047' },
  { code: '6050', name: 'Vehicle Insurance', type: 'Expense', parent: '6047' },
  { code: '6051', name: 'Vehicle Licensing', type: 'Expense', parent: '6047' },

  // OTHER EXPENSES
  { code: '7000', name: 'Other Expenses', type: 'Expense', parent: null },
  { code: '7001', name: 'Bank Interest Expense', type: 'Expense', parent: '7000' },
  { code: '7002', name: 'Commissions Paid', type: 'Expense', parent: '7000' }
];

async function run() {
  console.log('Starting COA Rebuild...');

  // 1. Wipe existing COA accounts
  console.log('Wiping existing accounts...');
  const { error: delErr } = await supabase
    .from('global_chart_of_accounts')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (delErr) {
    console.error('Failed to wipe accounts', delErr);
    return;
  }

  // 2. Insert Template Accounts
  console.log('Inserting template accounts...');
  for (const acc of TEMPLATE) {
    const { error: insErr } = await supabase
      .from('global_chart_of_accounts')
      .insert({
        account_code: acc.code,
        account_name: acc.name,
        account_type: acc.type,
        parent_code: acc.parent,
        is_active: true
      });
    if (insErr) {
      console.error(`Error inserting ${acc.code}:`, insErr);
    }
  }

  // 3. Insert specific bank accounts per workspace
  const { data: workspaces } = await supabase.from('workspaces').select('*');
  let nextSubCode = 1010; // Start dynamic banks at 1010

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

  console.log('Done!');
}

run().catch(console.error);
