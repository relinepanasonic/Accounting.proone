'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { getWorkspaceMappings } from './mappings';

export async function reconcileRecord(
  recordId: string,
  recordType: 'invoice' | 'expense' | 'payroll',
  bankReference: string,
  bankAccountId?: string
) {
  const supabase = await createClient();
  
  if (recordType === 'payroll') {
    const { error } = await supabase
      .from('payroll')
      .update({
        status: 'paid',
        payment_date: new Date().toISOString().split('T')[0],
        notes: `PAID VIA RECONCILIATION - ${bankReference}`,
      })
      .eq('id', recordId);

    if (error) {
      console.error('Error reconciling payroll:', error);
      throw new Error('Failed to reconcile payroll');
    }
  } else {
    const table = recordType === 'invoice' ? 'invoices' : 'transactions';
    const { error } = await supabase
      .from(table)
      .update({
        reconciled: true,
        bank_reference: bankReference || 'BANK-MATCHED',
        ...(bankAccountId && table === 'invoices' ? { bank_account_id: bankAccountId } : {})
      })
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
  bank_account_id?: string
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
      bank_reference
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
    const salesAccount = mappings.find(m => m.mapping_type === 'SALES')?.account_code || '4001';
    await supabase.from('journal_entries').insert([
      { workspace_id: ctx.activeWorkspaceId, account_code: bankAccountCode, transaction_date: todayStr, debit_amount: amount, credit_amount: 0, description: `Quick Income - ${description}`, reference_id: data.id, reference_type: 'quick_income' },
      { workspace_id: ctx.activeWorkspaceId, account_code: salesAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: amount, description: `Quick Income - ${description}`, reference_id: data.id, reference_type: 'quick_income' }
    ]);
  } else {
    const expenseAccount = mappings.find(m => m.mapping_type === 'EXPENSE')?.account_code || '5100';
    await supabase.from('journal_entries').insert([
      { workspace_id: ctx.activeWorkspaceId, account_code: expenseAccount, transaction_date: todayStr, debit_amount: amount, credit_amount: 0, description: `Quick Expense - ${description}`, reference_id: data.id, reference_type: 'quick_expense' },
      { workspace_id: ctx.activeWorkspaceId, account_code: bankAccountCode, transaction_date: todayStr, debit_amount: 0, credit_amount: amount, description: `Quick Expense - ${description}`, reference_id: data.id, reference_type: 'quick_expense' }
    ]);
  }

  revalidatePath('/reconcile');
  revalidatePath('/invoices');
  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true, transactionId: data.id };
}
