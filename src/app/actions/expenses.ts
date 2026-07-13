'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface CreateExpensePayload {
  vendor: string;
  category: string;
  dueDate: string;
  amount: number;
  notes?: string;
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

  const { error } = await supabase.from('transactions').insert({
    workspace_id: workspaceId,
    description: payload.vendor,
    category: payload.category,
    amount: payload.amount,
    due_date: payload.dueDate,
    status: 'pending',
    is_upcoming_bill: true,
  });

  if (error) {
    console.error('Error recording expense:', error);
    throw new Error('Failed to record expense');
  }

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

  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true, status: nextStatus };
}
