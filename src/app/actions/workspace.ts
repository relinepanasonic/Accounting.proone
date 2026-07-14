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

/**
 * Create a New Workspace / Company Entity and immediately link authenticated user as superadmin.
 */
export async function createWorkspace(workspaceName: string) {
  try {
    if (!workspaceName || !workspaceName.trim()) {
      return { success: false, error: 'Company or Workspace name is required.' };
    }

    const supabase = await createClient();
    const cookieStore = await cookies();

    // Step 1: Fetch authenticated user ID
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required. Please sign in to create a new workspace entity.',
      };
    }

    // Step 2: INSERT new company into workspaces table and return new id
    const { data: newWs, error: createError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName.trim(),
      })
      .select('id, name')
      .single();

    if (createError || !newWs) {
      return {
        success: false,
        error: createError?.message || 'Failed to insert into workspaces table.',
      };
    }

    // Step 3 (The Missing Link): Immediately INSERT row into workspace_members table with role 'superadmin'
    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: newWs.id,
      user_id: user.id,
      role: 'superadmin',
    });

    if (memberError) {
      return {
        success: false,
        error: `Company created, but linking user failed: ${memberError.message}`,
      };
    }

    // Step 4: Set the active_workspace_id cookie so user is instantly switched to the new company
    cookieStore.set('active_workspace_id', newWs.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });

    // Step 5: Force layout re-render
    revalidatePath('/', 'layout');

    return {
      success: true,
      workspace: {
        id: newWs.id,
        name: newWs.name,
        role: 'superadmin',
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to create new company workspace.',
    };
  }
}

