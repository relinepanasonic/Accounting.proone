'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

export async function toggleClientAssignment(clientId: string, userId: string, isAssigned: boolean) {
  const supabase = await createClient();
  const { activeWorkspaceId, role } = await getAuthenticatedWorkspaceContext(supabase);

  if (role !== 'superadmin' && role !== 'founder') {
    return { success: false, error: 'Unauthorized. Only superadmin can assign clients.' };
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (isAssigned) {
    const { error } = await supabase.from('client_assignments').insert({
      workspace_id: activeWorkspaceId,
      client_id: clientId,
      user_id: userId,
      assigned_by: user?.id
    });
    if (error && error.code !== '23505') { // Ignore unique violation
      console.error('Error assigning client:', error);
      return { success: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from('client_assignments')
      .delete()
      .match({ workspace_id: activeWorkspaceId, client_id: clientId, user_id: userId });
      
    if (error) {
      console.error('Error removing assignment:', error);
      return { success: false, error: error.message };
    }
  }

  revalidatePath('/productivity/assignments');
  return { success: true };
}
