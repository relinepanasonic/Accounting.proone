import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: workspaces } = await supabase.from('workspaces').select('id, name');
  console.log('Workspaces:', workspaces);

  if (workspaces) {
    const ptPintu = workspaces.find((w: any) => w.name.includes('Pintu'));
    const profToko = workspaces.find((w: any) => w.name.includes('Prof'));

    if (ptPintu && profToko) {
      console.log('PT Pintu ID:', ptPintu.id);
      console.log('Prof Toko ID:', profToko.id);

      const { data: invoices, error } = await supabase.from('invoices').select('id, invoice_number, workspace_id').eq('workspace_id', ptPintu.id);
      console.log('Invoices in PT Pintu:', invoices?.length, error);

      if (invoices && invoices.length > 0) {
        console.log('Sample invoice:', invoices[0].invoice_number);
      }
    }
  }
}
main();
