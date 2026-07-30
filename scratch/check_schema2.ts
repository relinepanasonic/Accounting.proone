process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  const { data: invs } = await supabase.from('invoices').select('*').limit(1);
  if (invs && invs.length > 0) {
    console.log('Invoices columns:');
    Object.keys(invs[0]).forEach(k => console.log(k));
  } else {
    console.log('No invoices');
  }

  const { data: ws } = await supabase.from('workspaces').select('id, name');
  console.log('Workspaces:', ws);
}
checkSchema();
