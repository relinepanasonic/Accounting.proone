import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const destWorkspaceId = 'f7262187-2a08-4454-b046-b4fd91f2f642'; // Prof Toko

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, created_at')
    .eq('workspace_id', destWorkspaceId)
    .order('created_at', { ascending: true });

  if (error || !invoices) {
    console.error('Error fetching invoices:', error);
    return;
  }

  const invoiceNumberCounts = new Map<string, any[]>();
  for (const inv of invoices) {
    if (!invoiceNumberCounts.has(inv.invoice_number)) {
      invoiceNumberCounts.set(inv.invoice_number, []);
    }
    invoiceNumberCounts.get(inv.invoice_number)!.push(inv);
  }

  const duplicates = [];
  for (const [invNum, invs] of invoiceNumberCounts.entries()) {
    if (invs.length > 1) {
      duplicates.push({ invoice_number: invNum, copies: invs.length, details: invs });
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicated invoice numbers:`);
    for (const dup of duplicates) {
      console.log(`- ${dup.invoice_number} has ${dup.copies} copies.`);
      
      // Keep the most recent one or the original one? Let's keep the one that was created earliest (original)
      // and delete the others.
      const toKeep = dup.details[0];
      const toDelete = dup.details.slice(1).map(d => d.id);
      
      console.log(`  Keeping ID: ${toKeep.id}, Deleting:`, toDelete);
      
      const { error: delError } = await supabase.from('invoices').delete().in('id', toDelete);
      if (delError) {
        console.error('  Failed to delete:', delError);
      } else {
        console.log('  Successfully deleted duplicates.');
      }
    }
  } else {
    console.log('No duplicate invoice numbers found in Prof Toko Online.');
  }
}

main();
