'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getWorkspaceMappings } from './mappings';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

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
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const finalDescription = payload.notes ? `${payload.vendor} - ${payload.notes}` : payload.vendor;

  const { data: txData, error } = await supabase.from('transactions').insert({
    workspace_id: activeWorkspaceId,
    description: finalDescription,
    category: payload.category,
    amount: payload.amount,
    due_date: payload.dueDate,
    reconciled: false,
    is_upcoming_bill: true,
  }).select('id').single();

  if (error || !txData) {
    console.error('Error recording expense:', error);
    throw new Error('Failed to record expense');
  }

  // Double-Entry Ledger: Expense Created (Debit Expense, Credit A/P)
  const mappings = await getWorkspaceMappings(activeWorkspaceId);
  const expenseAccount = mappings.find(m => m.mapping_type === 'EXPENSE')?.account_code || '5100';
  const apAccount = mappings.find(m => m.mapping_type === 'AP')?.account_code || '2000';

  const todayStr = new Date().toISOString().split('T')[0];
  await supabase.from('journal_entries').insert([
    { workspace_id: activeWorkspaceId, account_code: expenseAccount, transaction_date: todayStr, debit_amount: payload.amount, credit_amount: 0, description: finalDescription, reference_id: txData.id, reference_type: 'expense' },
    { workspace_id: activeWorkspaceId, account_code: apAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: payload.amount, description: finalDescription, reference_id: txData.id, reference_type: 'expense' }
  ]);

  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true };
}

export async function updateExpense(id: string, payload: CreateExpensePayload) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const finalDescription = payload.notes ? `${payload.vendor} - ${payload.notes}` : payload.vendor;

  const { error } = await supabase.from('transactions')
    .update({
      description: finalDescription,
      category: payload.category,
      amount: payload.amount,
      due_date: payload.dueDate,
    })
    .eq('id', id)
    .eq('workspace_id', activeWorkspaceId);

  if (error) {
    console.error('Error updating expense:', error);
    throw new Error('Failed to update expense');
  }

  const mappings = await getWorkspaceMappings(activeWorkspaceId);
  const expenseAccount = mappings.find(m => m.mapping_type === 'EXPENSE')?.account_code || '5100';
  const apAccount = mappings.find(m => m.mapping_type === 'AP')?.account_code || '2000';
  const todayStr = payload.dueDate || new Date().toISOString().split('T')[0];

  const { createAdminClient } = await import('@/lib/api/supabase-admin');
  const adminClient = createAdminClient();
  await adminClient.from('journal_entries').delete().eq('reference_id', id).eq('reference_type', 'expense');

  await supabase.from('journal_entries').insert([
    { workspace_id: activeWorkspaceId, account_code: expenseAccount, transaction_date: todayStr, debit_amount: payload.amount, credit_amount: 0, description: finalDescription, reference_id: id, reference_type: 'expense' },
    { workspace_id: activeWorkspaceId, account_code: apAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: payload.amount, description: finalDescription, reference_id: id, reference_type: 'expense' }
  ]);

  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true };
}

export async function toggleExpenseStatus(id: string, currentStatus: string) {
  const supabase = await createClient();
  const nextStatus = currentStatus.toLowerCase() === 'paid' ? 'pending' : 'paid';
  const nextReconciled = nextStatus === 'paid';

  const { error } = await supabase
    .from('transactions')
    .update({ reconciled: nextReconciled })
    .eq('id', id);

  if (error) {
    console.error('Error toggling expense status:', error);
    throw new Error('Failed to toggle expense status');
  }

  // Double-Entry Ledger for Payment (Debit A/P, Credit Cash)
  const { data: tx } = await supabase.from('transactions').select('amount, workspace_id, description').eq('id', id).single();
  if (tx) {
    if (nextStatus === 'paid') {
      const mappings = await getWorkspaceMappings(tx.workspace_id);
      const apAccount = mappings.find(m => m.mapping_type === 'AP')?.account_code || '2000';
      
      const todayStr = new Date().toISOString().split('T')[0];
      await supabase.from('journal_entries').delete().eq('reference_id', id).eq('reference_type', 'expense_payment');
      
      await supabase.from('journal_entries').insert([
        { workspace_id: tx.workspace_id, account_code: apAccount, transaction_date: todayStr, debit_amount: tx.amount, credit_amount: 0, description: `Payment for ${tx.description}`, reference_id: id, reference_type: 'expense_payment' },
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

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  
  // Use admin client to bypass RLS for deletion (especially for journal_entries which may lack delete policies)
  const { createAdminClient } = await import('@/lib/api/supabase-admin');
  const adminClient = createAdminClient();

  // Delete journal entries first (foreign key constraints or manual cascades)
  await adminClient.from('journal_entries').delete().eq('reference_id', id);

  const { error } = await adminClient
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('workspace_id', activeWorkspaceId);

  if (error) {
    console.error('Error deleting expense:', error);
    throw new Error('Failed to delete expense');
  }

  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true };
}
