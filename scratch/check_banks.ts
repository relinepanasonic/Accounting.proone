process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBanks() {
  const { data: banks } = await supabase.from('workspace_bank_accounts').select('*');
  console.log("Banks:", banks);
}

checkBanks();
