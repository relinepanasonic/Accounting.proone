process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_schema_info'); // Wait, we might not have a function for this.
  
  // Let's just select one invoice to see columns
  const { data: invs } = await supabase.from('invoices').select('*').limit(1);
  console.log('Invoices columns:', invs?.[0] ? Object.keys(invs[0]) : 'None');

  // Let's see workspace ID for PT Pintu Langit
  const { data: ws } = await supabase.from('workspaces').select('*');
  console.log('Workspaces:', ws);
}
checkSchema();
