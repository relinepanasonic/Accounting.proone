'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isAssignmentJob } from '@/lib/assignments/jobs';
import { revalidatePath } from 'next/cache';

const isMissingColumn = (error: any) => error?.code === '42703' || error?.code === 'PGRST204' || /\bjob\b/.test(error?.message || '');

export async function toggleClientAssignment(clientId: string, userId: string, job: string, isAssigned: boolean) {
  const supabase = await createClient();
  const { activeWorkspaceId, role } = await getAuthenticatedWorkspaceContext(supabase);

  if (role !== 'superadmin' && role !== 'founder') {
    return { success: false, error: 'Unauthorized. Only superadmin can assign clients.' };
  }
  if (!isAssignmentJob(job)) return { success: false, error: 'Unknown job.' };

  const { data: { user } } = await supabase.auth.getUser();

  if (isAssigned) {
    const row = { workspace_id: activeWorkspaceId, client_id: clientId, user_id: userId, assigned_by: user?.id };
    let { error } = await supabase.from('client_assignments').insert({ ...row, job });

    // Before the job migration has been run, only advertising can be saved (the old table has no job).
    if (error && isMissingColumn(error)) {
      if (job !== 'advertising') {
        return { success: false, error: 'Run supabase/migrations/20260930_assignment_jobs.sql in Supabase to assign other jobs.' };
      }
      ({ error } = await supabase.from('client_assignments').insert(row));
    }
    if (error && error.code !== '23505') { // ignore "already assigned"
      console.error('Error assigning client:', error);
      return { success: false, error: error.message };
    }
  } else {
    let { error } = await supabase
      .from('client_assignments')
      .delete()
      .match({ workspace_id: activeWorkspaceId, client_id: clientId, user_id: userId, job });
    if (error && isMissingColumn(error) && job === 'advertising') {
      ({ error } = await supabase.from('client_assignments').delete().match({ workspace_id: activeWorkspaceId, client_id: clientId, user_id: userId }));
    }
    if (error) {
      console.error('Error removing assignment:', error);
      return { success: false, error: error.message };
    }
  }

  revalidatePath('/productivity/assignments');
  return { success: true };
}
