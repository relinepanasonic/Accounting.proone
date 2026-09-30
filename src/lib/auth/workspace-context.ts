import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { withSharedCookieOptions } from '@/lib/supabase/cookie-options';
import { isFounderEmail } from '@/lib/auth/founders';

// 'none' = signed in but not a member of any workspace: no access to anything.
export type WorkspaceRole = 'founder' | 'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'client' | 'none';

/** Roles that may open finance modules. advertiser / client are limited to Pabrik Sosmed. */
export const FINANCE_ROLES: WorkspaceRole[] = ['founder', 'superadmin', 'accounting', 'admin'];


export interface WorkspaceTenantInfo {
  id: string;
  name: string;
  role: WorkspaceRole;
  logoUrl?: string;
}

export interface WorkspaceContextInfo {
  userId: string | null;
  userName?: string;
  userEmail?: string;
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  role: WorkspaceRole;
  availableWorkspaces: WorkspaceTenantInfo[];
}

const NO_ACCESS: Omit<WorkspaceContextInfo, 'userId' | 'userName' | 'userEmail'> = {
  activeWorkspaceId: '',
  activeWorkspaceName: '',
  role: 'none',
  availableWorkspaces: [],
};

/**
 * Multi-Tenant Active Workspace Engine
 * Resolves user's allowed workspace tenants and active_workspace_id cookie.
 * Wrapped in React `cache` so it only runs once per request.
 */
export const getAuthenticatedWorkspaceContext = cache(async (
  supabase?: any
): Promise<WorkspaceContextInfo> => {
  const supabaseClient = supabase || (await createClient());

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  const cookieStore = await cookies();
  const cookieWorkspaceId = cookieStore.get('active_workspace_id')?.value;

  const resolvedName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Nico');
  const resolvedEmail = user?.email || 'nico@professortoko.com';

  // 1. Authenticated User flow
  if (user) {
    // Auto-link any pending email invitations right when the staff member logs in
    if (user.email) {
      try {
        await supabaseClient
          .from('workspace_members')
          .update({ user_id: user.id })
          .ilike('email', user.email.trim())
          .is('user_id', null);
      } catch {
        // Can be ignored during read-only or render pass
      }
    }

    const isFounder = isFounderEmail(user.email);

    let memberRows: any[] | null = null;
    
    if (isFounder) {
      // Founder gets access to ALL workspaces automatically
      // We must use the admin client to bypass RLS since the founder might not be in workspace_members
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: allWorkspaces } = await adminClient
        .from('workspaces')
        .select('id, name')
        .order('created_at', { ascending: true });
        
      if (allWorkspaces && allWorkspaces.length > 0) {
        memberRows = allWorkspaces.map(w => ({
          workspace_id: w.id,
          role: 'founder',
          workspaces: w
        }));
      }
    } else {
      const { data: byUser } = await supabaseClient
        .from('workspace_members')
        .select('workspace_id, role, workspaces (id, name)')
        .eq('user_id', user.id);

      if (byUser && byUser.length > 0) {
        memberRows = byUser;
      } else if (user.email) {
        const { data: byEmail } = await supabaseClient
          .from('workspace_members')
          .select('workspace_id, role, workspaces (id, name)')
          .ilike('email', user.email.trim());

        if (byEmail && byEmail.length > 0) {
          memberRows = byEmail;
        }
      }
    }

    if (memberRows && memberRows.length > 0) {
      const allowedWorkspaces: WorkspaceTenantInfo[] = memberRows.map((m: any) => {
        const wsObj = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
        return {
          id: m.workspace_id || wsObj?.id,
          name: wsObj?.name || 'Workspace Enterprise',
          role: (m.role as any) || 'accounting',
        };
      });

      // Check if cookie matches one of allowed workspaces
      const matched = allowedWorkspaces.find((w) => w.id === cookieWorkspaceId);
      const active = matched || allowedWorkspaces[0];

      // If missing or invalid cookie, try setting it to first allowed workspace
      if (!matched) {
        try {
          cookieStore.set('active_workspace_id', active.id, withSharedCookieOptions({
            maxAge: 60 * 60 * 24 * 365,
          }));
        } catch {
          // Can be ignored if called during render pass
        }
      }

      return {
        userId: user.id,
        userName: resolvedName,
        userEmail: resolvedEmail,
        activeWorkspaceId: active.id,
        activeWorkspaceName: active.name,
        role: active.role,
        availableWorkspaces: allowedWorkspaces,
      };
    }

    // Signed in but not a member of any workspace: no access (never fall back to a staff role).
    return { userId: user.id, userName: resolvedName, userEmail: resolvedEmail, ...NO_ACCESS };
  }

  // Not signed in: no access, no seed/preview workspace.
  return { userId: null, userName: resolvedName, userEmail: resolvedEmail, ...NO_ACCESS };
});
