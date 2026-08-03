const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillInvoices() {
  console.log('Starting Backfill of Historical Invoices...');

  // 1. Fetch all invoices
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*');

  if (invError) {
    console.error('Error fetching invoices:', invError);
    return;
  }

  console.log(`Found ${invoices.length} invoices to process.`);

  let insertedCount = 0;

  for (const inv of invoices) {
    const totalAmount = Number(inv.total_amount) || 0;
    
    // We will generate the base A/R and Revenue entries for every invoice (Accrual)
    const journalEntries = [
      // 1. Debit Accounts Receivable (1002)
      {
        workspace_id: inv.workspace_id,
        account_code: '1002', // Standard A/R
        transaction_date: inv.issue_date || inv.created_at,
        debit_amount: totalAmount,
        credit_amount: 0,
        description: `Invoice ${inv.invoice_number} Issued`,
        reference_id: inv.id,
        reference_type: 'invoice'
      },
      // 2. Credit Sales Revenue (4001)
      {
        workspace_id: inv.workspace_id,
        account_code: '4001', // Standard Sales
        transaction_date: inv.issue_date || inv.created_at,
        debit_amount: 0,
        credit_amount: totalAmount,
        description: `Invoice ${inv.invoice_number} Revenue`,
        reference_id: inv.id,
        reference_type: 'invoice'
      }
    ];

    // If the invoice is PAID, we also need to move from A/R to Bank
    if (inv.status === 'paid') {
      // Default to Petty Cash (1001) or specific bank if available
      const bankCode = inv.bank_account_id ? '1001' : '1001'; // Simplified mapping for now
      
      journalEntries.push(
        // 3. Debit Bank Account
        {
          workspace_id: inv.workspace_id,
          account_code: bankCode,
          transaction_date: inv.updated_at || inv.created_at, // Use updated_at as payment date approximation
          debit_amount: totalAmount,
          credit_amount: 0,
          description: `Payment Received for Invoice ${inv.invoice_number}`,
          reference_id: inv.id,
          reference_type: 'invoice_payment'
        },
        // 4. Credit Accounts Receivable (clearing the balance)
        {
          workspace_id: inv.workspace_id,
          account_code: '1002', 
          transaction_date: inv.updated_at || inv.created_at,
          debit_amount: 0,
          credit_amount: totalAmount,
          description: `Clear A/R for Invoice ${inv.invoice_number}`,
          reference_id: inv.id,
          reference_type: 'invoice_payment'
        }
      );
    }

    // Insert these entries
    const { error: insertErr } = await supabase
      .from('journal_entries')
      .insert(journalEntries);

    if (insertErr) {
      console.error(`Error inserting entries for Invoice ${inv.invoice_number}:`, insertErr.message);
    } else {
      insertedCount += journalEntries.length;
      console.log(`✓ Invoice ${inv.invoice_number}: Inserted ${journalEntries.length} entries`);
    }
  }

  console.log(`\nBackfill Complete! Inserted ${insertedCount} total ledger lines.`);
}

backfillInvoices();
