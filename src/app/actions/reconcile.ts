'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export async function reconcileRecord(
  recordId: string,
  recordType: 'invoice' | 'expense' | 'payroll',
  bankReference: string
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
  bank_reference: string
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
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating quick transaction:', error);
    throw new Error('Failed to create and reconcile transaction');
  }

  revalidatePath('/reconcile');
  revalidatePath('/invoices');
  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true, transactionId: data.id };
}
