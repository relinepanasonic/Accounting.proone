'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function switchWorkspace(newWorkspaceId: string) {
  try {
    if (!newWorkspaceId) {
      return { success: false, error: 'Invalid Target Workspace ID.' };
    }

    const cookieStore = await cookies();

    // Verify membership if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: membership, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('workspace_id', newWorkspaceId)
        .single();

      if (error || !membership) {
        return {
          success: false,
          error: 'Security Clearance Denied: You do not belong to the requested workspace.',
        };
      }
    }

    // Set secure cookie
    cookieStore.set('active_workspace_id', newWorkspaceId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });

    revalidatePath('/', 'layout');
    return { success: true, newWorkspaceId };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to switch workspace context.',
    };
  }
}
