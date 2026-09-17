import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { error } = await supabase
    .from('workspace_bank_accounts')
    .update({ 
      bank_name: 'Bank BCA', 
      account_number: '429-577-5778' 
    })
    .eq('id', 'd329d8cf-ccdb-47b1-8275-8f4eb46db764');
  
  console.log("Error:", error);
}
main();
