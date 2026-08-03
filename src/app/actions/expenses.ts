'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface CreateExpensePayload {
  vendor: string;
  category: string;
  dueDate: string;
  amount: number;
  notes?: string;
  isHistorical?: boolean;
}

export async function createExpense(payload: CreateExpensePayload) {
  const supabase = await createClient();

  // Retrieve active workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1);

  const workspaceId =
    workspaces && workspaces.length > 0
      ? workspaces[0].id
      : '11111111-1111-1111-1111-111111111111';

  const finalDescription = payload.notes ? `${payload.vendor} - ${payload.notes}` : payload.vendor;

  const { data: txData, error } = await supabase.from('transactions').insert({
    workspace_id: workspaceId,
    description: finalDescription,
    category: payload.category,
    amount: payload.amount,
    due_date: payload.dueDate,
    status: 'pending',
    is_upcoming_bill: true,
  }).select('id').single();

  if (error || !txData) {
    console.error('Error recording expense:', error);
    throw new Error('Failed to record expense');
  }

  // Double-Entry Ledger: Expense Created (Debit Expense, Credit A/P)
  const todayStr = new Date().toISOString().split('T')[0];
  await supabase.from('journal_entries').insert([
    { workspace_id: workspaceId, account_code: '5100', transaction_date: todayStr, debit_amount: payload.amount, credit_amount: 0, description: finalDescription, reference_id: txData.id, reference_type: 'expense' },
    { workspace_id: workspaceId, account_code: '2000', transaction_date: todayStr, debit_amount: 0, credit_amount: payload.amount, description: finalDescription, reference_id: txData.id, reference_type: 'expense' }
  ]);

  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true };
}

export async function toggleExpenseStatus(id: string, currentStatus: string) {
  const supabase = await createClient();
  const nextStatus = currentStatus.toLowerCase() === 'paid' ? 'pending' : 'paid';

  const { error } = await supabase
    .from('transactions')
    .update({ status: nextStatus })
    .eq('id', id);

  if (error) {
    console.error('Error toggling expense status:', error);
    throw new Error('Failed to toggle expense status');
  }

  // Double-Entry Ledger for Payment (Debit A/P, Credit Cash)
  const { data: tx } = await supabase.from('transactions').select('amount, workspace_id, description').eq('id', id).single();
  if (tx) {
    if (nextStatus === 'paid') {
      const todayStr = new Date().toISOString().split('T')[0];
      await supabase.from('journal_entries').delete().eq('reference_id', id).eq('reference_type', 'expense_payment');
      
      await supabase.from('journal_entries').insert([
        { workspace_id: tx.workspace_id, account_code: '2000', transaction_date: todayStr, debit_amount: tx.amount, credit_amount: 0, description: `Payment for ${tx.description}`, reference_id: id, reference_type: 'expense_payment' },
        { workspace_id: tx.workspace_id, account_code: '1010', transaction_date: todayStr, debit_amount: 0, credit_amount: tx.amount, description: `Payment for ${tx.description}`, reference_id: id, reference_type: 'expense_payment' }
      ]);
    } else {
      await supabase.from('journal_entries').delete().eq('reference_id', id).eq('reference_type', 'expense_payment');
    }
  }

  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true, status: nextStatus };
}
