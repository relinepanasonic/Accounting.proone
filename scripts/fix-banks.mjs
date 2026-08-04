import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: accounts, error } = await supabase
    .from('workspace_bank_accounts')
    .select('*');

  if (error) {
    console.error('Error fetching accounts', error);
    return;
  }

  console.log('Original Accounts:');
  for (const acc of accounts) {
    console.log(acc);
    let dirty = false;
    let newName = acc.bank_name;
    let newNo = acc.account_number;
    let newHolder = acc.account_name;

    if (acc.bank_name.includes('Secondary Bank')) {
      newName = 'Bank Jago';
      newNo = '1029-0035-8121';
      newHolder = 'Nico Winarta Japar';
      dirty = true;
    } else if (acc.bank_name.includes('Primary Bank Account')) {
      newName = 'Bank BCA';
      newNo = '3882-171717';
      newHolder = 'Nico Winarta Japar';
      dirty = true;
    } else if (acc.account_number.includes('5395-013-031')) {
      // Third account, already good
      newHolder = 'Nico Winarta Japar';
      dirty = true;
    }

    if (dirty) {
      const { error: updErr } = await supabase
        .from('workspace_bank_accounts')
        .update({
          bank_name: newName,
          account_number: newNo,
          account_name: newHolder
        })
        .eq('id', acc.id);
      
      if (updErr) {
        console.error('Failed to update', acc.id, updErr);
      } else {
        console.log(`Updated ${acc.id} successfully!`);
      }
    }
  }
}

main();
