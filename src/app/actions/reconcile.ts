'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { getWorkspaceMappings } from './mappings';

export async function reconcileRecord(
  recordId: string,
  recordType: 'invoice' | 'expense' | 'payroll' | 'income',
  bankReference: string,
  bankAccountId?: string,
  adjustedAmount?: number,
  isPartialPayment?: boolean
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
    const updateData: any = {
      ...(bankAccountId && table === 'invoices' ? { bank_account_id: bankAccountId } : {})
    };
    
      if (table === 'invoices') {
        const { data: inv } = await supabase.from('invoices').select('workspace_id, invoice_number, total_amount, amount_paid').eq('id', recordId).single();
        if (inv) {
          if (isPartialPayment) {
            updateData.amount_paid = (Number(inv.amount_paid || 0)) + Number(adjustedAmount || 0);
          } else {
            updateData.reconciled = true;
            updateData.bank_reference = bankReference || 'BANK-MATCHED';
            if (adjustedAmount !== undefined) {
              updateData.total_amount = adjustedAmount;
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
          const arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1100';
          const paymentAmount = isPartialPayment ? Number(adjustedAmount || 0) : (adjustedAmount !== undefined ? adjustedAmount : (Number(inv.total_amount) - Number(inv.amount_paid)));
          const todayStr = new Date().toISOString().split('T')[0];

          await supabase.from('journal_entries').insert([
            { workspace_id: inv.workspace_id, account_code: bankAccountCode, transaction_date: todayStr, debit_amount: paymentAmount, credit_amount: 0, description: `Bank Match - Invoice ${inv.invoice_number}`, reference_id: recordId, reference_type: 'bank_match' },
            { workspace_id: inv.workspace_id, account_code: arAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: paymentAmount, description: `Bank Match - Invoice ${inv.invoice_number}`, reference_id: recordId, reference_type: 'bank_match' }
          ]);
        }
      } else {
        updateData.reconciled = true;
        updateData.bank_reference = bankReference || 'BANK-MATCHED';
        if (adjustedAmount !== undefined) {
          updateData.amount = adjustedAmount;
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
