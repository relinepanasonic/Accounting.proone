import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const sourceWorkspaceId = '11111111-1111-1111-1111-111111111111'; // PT Pintu
  const destWorkspaceId = 'f7262187-2a08-4454-b046-b4fd91f2f642'; // Prof Toko

  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('workspace_id', sourceWorkspaceId);

  if (invError || !invoices) {
    console.error('Error fetching invoices:', invError);
    return;
  }

  const invoiceIds = invoices.map((i: any) => i.id);
  console.log(`Found ${invoiceIds.length} invoices to migrate.`);

  if (invoiceIds.length === 0) return;

  for (const inv of invoices) {
    console.log(`Migrating: ${inv.invoice_number}`);
  }

  // 1. Update invoices
  const { error: e1 } = await supabase.from('invoices')
    .update({ workspace_id: destWorkspaceId })
    .in('id', invoiceIds);
  console.log('Updated invoices:', e1 || 'OK');

  // 2. Update invoice_line_items
  const { error: e2 } = await supabase.from('invoice_line_items')
    .update({ workspace_id: destWorkspaceId })
    .in('invoice_id', invoiceIds);
  console.log('Updated line items:', e2 || 'OK');

  // 3. Update transactions
  const { error: e3 } = await supabase.from('transactions')
    .update({ workspace_id: destWorkspaceId })
    .in('reference_id', invoiceIds);
  console.log('Updated transactions:', e3 || 'OK');

  // 4. Update journal_entries
  const { error: e4 } = await supabase.from('journal_entries')
    .update({ workspace_id: destWorkspaceId })
    .in('reference_id', invoiceIds);
  console.log('Updated journal entries:', e4 || 'OK');

  console.log('Migration completed.');
}

main();
