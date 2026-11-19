'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { PT_WORKSPACE_ID } from '@/lib/workspaces/known';
import { assignableWorkspaces } from '@/lib/workspaces/assignable';

/** PT Pintu only: say which workspace an expense belongs to. Empty = PT's own. */
export async function updateExpenseAssignment(transactionId: string, assignedWorkspaceId: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Only Accounting, Admin and the owners can assign expenses.' };
    if (ctx.activeWorkspaceId !== PT_WORKSPACE_ID) return { success: false, error: 'Only PT Pintu hands expenses to other workspaces.' };
    let target: string | null = null;
    if (assignedWorkspaceId) {
      if (assignedWorkspaceId === PT_WORKSPACE_ID || !(await assignableWorkspaces(ctx)).some((w) => w.id === assignedWorkspaceId)) return { success: false, error: 'You cannot assign an expense to that workspace.' };
      target = assignedWorkspaceId;
    }
    const { data: changed, error } = await supabase.from('transactions').update({ assigned_workspace_id: target }).eq('id', transactionId).eq('workspace_id', ctx.activeWorkspaceId).select('id');
    if (error) return { success: false, error: error.code === '42703' || /assigned_workspace_id/.test(error.message) ? 'Run supabase/migrations/20261012_transaction_workspace.sql in Supabase first.' : error.message };
    if (!changed || changed.length === 0) return { success: false, error: 'Nothing was changed (expense not found or not allowed).' };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not assign.' };
  }
}

/** PT Pintu only: hand several expenses to one workspace at once (empty target = back to PT's own). */
export async function updateExpenseAssignments(transactionIds: string[], assignedWorkspaceId: string | null): Promise<{ success: boolean; changed?: number; error?: string }> {
  try {
    const ids = Array.from(new Set((transactionIds || []).map(String))).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
    if (!ids.length) return { success: false, error: 'Select at least one expense.' };
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Only Accounting, Admin and the owners can assign expenses.' };
    if (ctx.activeWorkspaceId !== PT_WORKSPACE_ID) return { success: false, error: 'Only PT Pintu hands expenses to other workspaces.' };
    let target: string | null = null;
    if (assignedWorkspaceId) {
      if (assignedWorkspaceId === PT_WORKSPACE_ID || !(await assignableWorkspaces(ctx)).some((w) => w.id === assignedWorkspaceId)) return { success: false, error: 'You cannot assign an expense to that workspace.' };
      target = assignedWorkspaceId;
    }
    const { data: changed, error } = await supabase.from('transactions').update({ assigned_workspace_id: target }).in('id', ids).eq('workspace_id', ctx.activeWorkspaceId).select('id');
    if (error) return { success: false, error: error.code === '42703' || /assigned_workspace_id/.test(error.message) ? 'Run supabase/migrations/20261012_transaction_workspace.sql in Supabase first.' : error.message };
    return { success: true, changed: changed?.length || 0 };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not assign.' };
  }
}
