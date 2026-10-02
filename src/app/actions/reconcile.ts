'use server';

import { revalidatePath } from 'next/cache';
import { resolveArAccount } from '@/lib/accounting/accounts';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { onInvoicePaid } from '@/lib/sales/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { getWorkspaceMappings } from './mappings';

export async function reconcileRecord(
  recordId: string,
  recordType: 'invoice' | 'expense' | 'payroll' | 'income',
  bankReference: string,
  bankAccountId?: string,
  adjustedAmount?: number,
  isPartialPayment?: boolean,
  taxWriteoffAmount?: number,
  bankDate?: string
) {
  const supabase = await createClient();
  
  if (recordType === 'payroll') {
    const updateData: any = {
      status: 'paid',
      payment_date: new Date().toISOString().split('T')[0],
      notes: `PAID VIA RECONCILIATION - ${bankReference}`,
    };
    if (adjustedAmount !== undefined && !isPartialPayment) {
      updateData.total_payment = adjustedAmount;
    }
    
    const { error } = await supabase
      .from('payroll')
      .update(updateData)
      .eq('id', recordId);

    if (error) {
      console.error('Error reconciling payroll:', error);
      throw new Error('Failed to reconcile payroll');
    }
  } else {
    const table = recordType === 'invoice' ? 'invoices' : 'transactions';
    let linkedInvoiceId: string | null = null;
    const updateData: any = {
      ...(bankAccountId && table === 'invoices' ? { bank_account_id: bankAccountId } : {})
    };
    
      if (table === 'invoices') {
        const { data: inv } = await supabase.from('invoices').select('workspace_id, invoice_number, total_amount, amount_paid').eq('id', recordId).single();
        if (inv) {
          // Balance already zero means the payment was booked earlier (Paid click): confirm only, no second ledger entry.
          const alreadyBooked = Number(inv.total_amount) - Number(inv.amount_paid || 0) <= 0;
          if (isPartialPayment) {
            updateData.amount_paid = (Number(inv.amount_paid || 0)) + Number(adjustedAmount || 0);
          } else {
            updateData.reconciled = true;
            updateData.bank_reference = bankReference || 'BANK-MATCHED';
            if (adjustedAmount !== undefined && !taxWriteoffAmount) {
              updateData.total_amount = adjustedAmount;
            }
            if (!alreadyBooked) {
              updateData.amount_paid = updateData.total_amount ?? inv.total_amount;
              updateData.status = 'paid';
            }
          }
          
          // Create Ledger Double-Entry for the payment
          const ctx = await getAuthenticatedWorkspaceContext(supabase);
          const { getWorkspaceMappings } = await import('./mappings');
          const mappings = await getWorkspaceMappings(ctx.activeWorkspaceId);
          let bankAccountCode = '1010';
          if (bankAccountId && bankAccountId !== 'all' && bankAccountId !== 'custom') {
            const { data: bankRes } = await supabase.from('workspace_bank_accounts').select('coa_account_code').eq('id', bankAccountId).single();
            if (bankRes?.coa_account_code) bankAccountCode = bankRes.coa_account_code;
          }
          const arAccount = resolveArAccount(mappings);
          // Book the payment on the day the money hit the bank, not the day it was matched.
          const todayStr = bankDate || new Date().toISOString().split('T')[0];
          const actualBankRef = bankReference || 'BANK-MATCHED';

          if (alreadyBooked && !isPartialPayment) {
            // nothing to post
          } else if (taxWriteoffAmount) {
             const taxExpenseAccount = mappings.find(m => m.mapping_type === 'TAX_EXPENSE')?.account_code || '6010';
             const bankReceived = Number(adjustedAmount || 0);
             const totalAR = bankReceived + taxWriteoffAmount;
             await supabase.from('journal_entries').insert([
                { workspace_id: inv.workspace_id, account_code: bankAccountCode, transaction_date: todayStr, debit_amount: bankReceived, credit_amount: 0, description: `Bank Match - Invoice ${inv.invoice_number} | ${actualBankRef}`, reference_id: recordId, reference_type: 'bank_match' },
                { workspace_id: inv.workspace_id, account_code: taxExpenseAccount, transaction_date: todayStr, debit_amount: taxWriteoffAmount, credit_amount: 0, description: `Tax/Fee Write-off - Invoice ${inv.invoice_number}`, reference_id: recordId, reference_type: 'bank_match' },
                { workspace_id: inv.workspace_id, account_code: arAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: totalAR, description: `Bank Match - Invoice ${inv.invoice_number} | ${actualBankRef}`, reference_id: recordId, reference_type: 'bank_match' }
             ]);
          } else {
             const paymentAmount = isPartialPayment ? Number(adjustedAmount || 0) : (adjustedAmount !== undefined ? adjustedAmount : (Number(inv.total_amount) - Number(inv.amount_paid)));
             await supabase.from('journal_entries').insert([
                { workspace_id: inv.workspace_id, account_code: bankAccountCode, transaction_date: todayStr, debit_amount: paymentAmount, credit_amount: 0, description: `Bank Match - Invoice ${inv.invoice_number} | ${actualBankRef}`, reference_id: recordId, reference_type: 'bank_match' },
                { workspace_id: inv.workspace_id, account_code: arAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: paymentAmount, description: `Bank Match - Invoice ${inv.invoice_number} | ${actualBankRef}`, reference_id: recordId, reference_type: 'bank_match' }
             ]);
          }
        }
      } else {
        updateData.reconciled = true;
        updateData.bank_reference = bankReference || 'BANK-MATCHED';
        if (adjustedAmount !== undefined) {
          updateData.amount = adjustedAmount;
        }
        // Invoice payment: the real payment date is the bank date, not the day "Paid" was clicked.
        const { data: tx } = await supabase.from('transactions').select('invoice_id, amount').eq('id', recordId).single();
        if (tx?.invoice_id) {
          linkedInvoiceId = tx.invoice_id;
          // Amount adjusted to the bank figure: keep the ledger lines and the invoice's paid total in step.
          if (adjustedAmount !== undefined && Number(adjustedAmount) !== Number(tx.amount)) {
            await supabase.from('journal_entries').update({ debit_amount: adjustedAmount }).eq('reference_id', recordId).eq('reference_type', 'payment_tx').gt('debit_amount', 0);
            await supabase.from('journal_entries').update({ credit_amount: adjustedAmount }).eq('reference_id', recordId).eq('reference_type', 'payment_tx').gt('credit_amount', 0);
            const { data: linkedInv } = await supabase.from('invoices').select('amount_paid').eq('id', tx.invoice_id).single();
            if (linkedInv) {
              await supabase.from('invoices').update({ amount_paid: Number(linkedInv.amount_paid || 0) + Number(adjustedAmount) - Number(tx.amount) }).eq('id', tx.invoice_id);
            }
          }
          if (bankDate) {
            updateData.transaction_date = bankDate;
            await supabase.from('journal_entries').update({ transaction_date: bankDate }).eq('reference_id', recordId).eq('reference_type', 'payment_tx');
          }
        }
      }

    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', recordId);

    if (error) {
      console.error('Error reconciling record:', error);
      throw new Error('Failed to reconcile record');
    }

    // Matching a bank line that pays an invoice in full wins the deal.
    if (recordType === 'invoice' && updateData.status === 'paid') await onInvoicePaid(createAdminClient(), recordId);
    if (linkedInvoiceId) {
      const { data: li } = await supabase.from('invoices').select('status').eq('id', linkedInvoiceId).maybeSingle();
      if (li?.status === 'paid') await onInvoicePaid(createAdminClient(), linkedInvoiceId);
    }

    // Once every payment of an invoice is confirmed against the bank, the invoice itself is reconciled.
    if (linkedInvoiceId) {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', linkedInvoiceId)
        .eq('type', 'income')
        .neq('reconciled', true);
      if (!count) {
        await supabase.from('invoices').update({ reconciled: true, bank_reference: bankReference || 'BANK-MATCHED' }).eq('id', linkedInvoiceId);
      }
    }
  }

  revalidatePath('/payroll');
  revalidatePath('/reconcile');
  revalidatePath('/invoices');
  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true };
}

export async function quickResolveAndReconcile(
  type: 'expense' | 'income',
  category: string,
  amount: number,
  transaction_date: string,
  description: string,
  bank_reference: string,
  bank_account_id?: string,
  client_id?: string
) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  
  if (!ctx.activeWorkspaceId) {
    throw new Error('Unauthorized: No active workspace');
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      type,
      category,
      amount,
      transaction_date,
      description,
      reconciled: true,
      bank_reference,
      client_id: client_id || null
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating quick transaction:', error);
    throw new Error('Failed to create and reconcile transaction');
  }

  // 2. Ledger Double-Entry
  const mappings = await getWorkspaceMappings(ctx.activeWorkspaceId);
  let bankAccountCode = '1010';
  if (bank_account_id && bank_account_id !== 'all' && bank_account_id !== 'custom') {
    const { data: bankRes } = await supabase.from('workspace_bank_accounts').select('coa_account_code').eq('id', bank_account_id).single();
    if (bankRes?.coa_account_code) {
      bankAccountCode = bankRes.coa_account_code;
    }
  }

  const todayStr = transaction_date || new Date().toISOString().split('T')[0];

  if (type === 'income') {
    let salesAccount = mappings.find(m => m.mapping_type === 'SALES')?.account_code || '4000';
    if (salesAccount === '4001') salesAccount = '4000';
    await supabase.from('journal_entries').insert([
      { workspace_id: ctx.activeWorkspaceId, account_code: bankAccountCode, transaction_date: todayStr, debit_amount: amount, credit_amount: 0, description: `Quick Income - ${description}`, reference_id: data.id, reference_type: 'quick_income' },
      { workspace_id: ctx.activeWorkspaceId, account_code: salesAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: amount, description: `Quick Income - ${description}`, reference_id: data.id, reference_type: 'quick_income' }
    ]);
  } else {
    // If category starts with '12' (e.g. 1201 Office Equipment), it's a fixed asset.
    const isFixedAsset = category.startsWith('12');
    
    // category is typically in format "6006 - Advertising", extract "6006"
    const parsedAccountCode = category.split(' ')[0].trim();
    // Use the parsed code if it exists and looks like an account code (digits), otherwise fallback
    let expenseAccount = (/^\d+$/.test(parsedAccountCode)) 
      ? parsedAccountCode 
      : (mappings.find(m => m.mapping_type === 'EXPENSE')?.account_code || '5000');
    if (expenseAccount === '5100') expenseAccount = '5000';

    await supabase.from('journal_entries').insert([
      { workspace_id: ctx.activeWorkspaceId, account_code: expenseAccount, transaction_date: todayStr, debit_amount: amount, credit_amount: 0, description: `Quick Expense - ${description}`, reference_id: data.id, reference_type: 'quick_expense' },
      { workspace_id: ctx.activeWorkspaceId, account_code: bankAccountCode, transaction_date: todayStr, debit_amount: 0, credit_amount: amount, description: `Quick Expense - ${description}`, reference_id: data.id, reference_type: 'quick_expense' }
    ]);

    // If it's a fixed asset, also register it in the Fixed Assets module automatically.
    if (isFixedAsset) {
      const assetName = description || 'Unnamed Fixed Asset';
      const { error: assetErr } = await supabase.from('fixed_assets').insert({
        workspace_id: ctx.activeWorkspaceId,
        asset_name: assetName,
        category: category,
        purchase_date: todayStr,
        initial_value: amount,
        salvage_value: 0,
        useful_life_years: 1, // Default 1 year (12 months) useful life
        // annual_depreciation is GENERATED by Postgres, do NOT pass it
        status: 'active'
      });
      if (assetErr) {
        console.error('Failed to insert fixed asset from reconcile:', assetErr);
      }
    }
  }

  revalidatePath('/reconcile');
  revalidatePath('/invoices');
  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true, transactionId: data.id };
}

/**
 * Undo a bank match: the record goes back to "not reconciled", the ledger lines posted by that match are
 * removed, and an invoice's paid amount is reduced by what the match added. Records that were CREATED by
 * Quick Log (they only exist because of that match) are deleted with their ledger lines.
 * Not restored: a total or amount that was adjusted during the match, and the original payment date.
 */
export async function unreconcileRecord(recordId: string, recordType: 'invoice' | 'expense' | 'payroll' | 'income') {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!['founder', 'superadmin', 'accounting'].includes(ctx.role)) {
    return { success: false, error: 'Only the Founder, a Superadmin or Accounting can undo a match.' };
  }

  let bankReference: string | null = null;
  let deleted = false;

  if (recordType === 'payroll') {
    const { data: row } = await supabase.from('payroll').select('notes, workspace_id').eq('id', recordId).single();
    if (!row || row.workspace_id !== ctx.activeWorkspaceId) return { success: false, error: 'Record not found.' };
    const m = String(row.notes || '').match(/^PAID VIA RECONCILIATION - ([\s\S]*)$/);
    bankReference = m ? m[1] : null;
    const { error } = await supabase.from('payroll').update({ status: 'draft', payment_date: null, notes: m ? '' : row.notes }).eq('id', recordId);
    if (error) return { success: false, error: error.message };
  } else if (recordType === 'invoice') {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, workspace_id, assigned_workspace_id, bank_reference, amount_paid, total_amount, status')
      .eq('id', recordId)
      .single();
    if (!inv || inv.workspace_id !== ctx.activeWorkspaceId) {
      return { success: false, error: 'Record not found.' };
    }
    bankReference = inv.bank_reference || null;

    // Ledger lines posted by this match: the ones carrying the bank reference, plus a tax/fee write-off
    // line posted in the same moment (it has no reference in its text).
    let credits = 0;
    if (bankReference) {
      const { data: lines } = await supabase
        .from('journal_entries')
        .select('id, description, credit_amount, created_at')
        .eq('reference_id', recordId)
        .eq('reference_type', 'bank_match');
      const matched = (lines || []).filter((l: any) => String(l.description || '').includes(bankReference as string));
      const times = matched.map((l: any) => new Date(l.created_at).getTime());
      const writeoffs = (lines || []).filter(
        (l: any) =>
          String(l.description || '').startsWith('Tax/Fee Write-off') &&
          times.some((t: number) => Math.abs(new Date(l.created_at).getTime() - t) < 5000)
      );
      const toDelete = [...matched, ...writeoffs].map((l: any) => l.id);
      credits = matched.reduce((sum: number, l: any) => sum + Number(l.credit_amount || 0), 0);
      if (toDelete.length > 0) {
        const { error } = await supabase.from('journal_entries').delete().in('id', toDelete);
        if (error) return { success: false, error: error.message };
      }
    }

    const update: Record<string, unknown> = { reconciled: false, bank_reference: null };
    if (credits > 0) {
      const newPaid = Math.max(0, Number(inv.amount_paid || 0) - credits);
      update.amount_paid = newPaid;
      update.status = newPaid <= 0 ? 'sent' : newPaid < Number(inv.total_amount) ? 'partial_paid' : inv.status;
    }
    const { error } = await supabase.from('invoices').update(update).eq('id', recordId);
    if (error) return { success: false, error: error.message };
  } else {
    const { data: tx } = await supabase
      .from('transactions')
      .select('id, workspace_id, invoice_id, bank_reference')
      .eq('id', recordId)
      .single();
    if (!tx || tx.workspace_id !== ctx.activeWorkspaceId) return { success: false, error: 'Record not found.' };
    bankReference = tx.bank_reference || null;

    const { data: quick } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_id', recordId)
      .in('reference_type', ['quick_income', 'quick_expense']);

    if (quick && quick.length > 0) {
      // Made by Quick Log for this bank line: it has no reason to exist without the match.
      await supabase.from('journal_entries').delete().in('id', quick.map((q: any) => q.id));
      const { error } = await supabase.from('transactions').delete().eq('id', recordId);
      if (error) return { success: false, error: error.message };
      deleted = true;
    } else {
      const { error } = await supabase.from('transactions').update({ reconciled: false, bank_reference: null }).eq('id', recordId);
      if (error) return { success: false, error: error.message };
      // A payment of an invoice is no longer confirmed by the bank, so neither is the invoice.
      if (tx.invoice_id) {
        await supabase.from('invoices').update({ reconciled: false, bank_reference: null }).eq('id', tx.invoice_id);
      }
    }
  }

  revalidatePath('/payroll');
  revalidatePath('/reconcile');
  revalidatePath('/invoices');
  revalidatePath('/expenses');
  revalidatePath('/ledger');
  revalidatePath('/');
  return { success: true, deleted, bankReference: bankReference && bankReference.startsWith('BANK-REF:') ? bankReference : null };
}
