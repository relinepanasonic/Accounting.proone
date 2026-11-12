'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

/**
 * HRD > Employee Directory: Tetap (permanent) or Freelance, for tax purposes. It is kept per company (workspace_members),
 * because one person can work for several companies. Needs supabase/migrations/20261114_employment_status.sql.
 */
export async function setEmploymentStatus(memberId: string, status: 'tetap' | 'freelance' | null): Promise<{ success: boolean; error?: string }> {
  try {
    if (status !== null && status !== 'tetap' && status !== 'freelance') return { success: false, error: 'Unknown status.' };
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Sign in again.' };
    if (!['superadmin', 'founder', 'accounting'].includes(ctx.role)) return { success: false, error: 'Only the Founder, a Superadmin or Accounting can set the employment status.' };

    const db = createAdminClient();
    const { data: member } = await db.from('workspace_members').select('id').eq('id', memberId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!member) return { success: false, error: 'Person not found in this company.' };
    const { error } = await db.from('workspace_members').update({ employment_status: status }).eq('id', memberId);
    if (error) {
      return { success: false, error: /employment_status/.test(error.message) ? 'Run supabase/migrations/20261114_employment_status.sql in Supabase first.' : error.message };
    }
    revalidatePath('/hrd/employees');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not save the status.' };
  }
}
