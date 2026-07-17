import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export interface WorkspaceTenantInfo {
  id: string;
  name: string;
  role: 'superadmin' | 'accounting' | 'admin';
  logoUrl?: string;
}

export interface WorkspaceContextInfo {
  userId: string | null;
  userName?: string;
  userEmail?: string;
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  role: 'superadmin' | 'accounting' | 'admin';
  availableWorkspaces: WorkspaceTenantInfo[];
}

const SEED_WORKSPACES: WorkspaceTenantInfo[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Professor Toko Online HQ',
    role: 'superadmin',
  },
  {
    id: '11111111-1111-1111-1111-111111111112',
    name: 'Nüman Kitchenware Enterprise',
    role: 'accounting',
  },
  {
    id: '11111111-1111-1111-1111-111111111113',
    name: 'Bochtmon Studio Venture',
    role: 'superadmin',
  },
];

/**
 * Multi-Tenant Active Workspace Engine
 * Resolves user's allowed workspace tenants and active_workspace_id cookie.
 */
export async function getAuthenticatedWorkspaceContext(
  supabase?: any
): Promise<WorkspaceContextInfo> {
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

    let memberRows: any[] | null = null;
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
          cookieStore.set('active_workspace_id', active.id, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
          });
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

    // If user is logged in but has no membership rows yet, query all real workspaces from the database
    // so they never see fake seed/dummy workspaces like "Professor Toko Online HQ"!
    const { data: realWorkspaces } = await supabaseClient
      .from('workspaces')
      .select('id, name')
      .order('created_at', { ascending: true });

    if (realWorkspaces && realWorkspaces.length > 0) {
      const allowedRealWorkspaces: WorkspaceTenantInfo[] = realWorkspaces.map((w: any) => ({
        id: w.id,
        name: w.name || 'Enterprise Tenant',
        role: 'accounting', // Default staff role
      }));

      const matched = allowedRealWorkspaces.find((w) => w.id === cookieWorkspaceId);
      const active = matched || allowedRealWorkspaces[0];

      if (!matched) {
        try {
          cookieStore.set('active_workspace_id', active.id, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
          });
        } catch {}
      }

      return {
        userId: user.id,
        userName: resolvedName,
        userEmail: resolvedEmail,
        activeWorkspaceId: active.id,
        activeWorkspaceName: active.name,
        role: active.role,
        availableWorkspaces: allowedRealWorkspaces,
      };
    }
  }

  // 2. Fallback Seed / Preview Flow (Only used when no user is logged in and no real database workspaces exist)
  const matchedSeed = SEED_WORKSPACES.find((w) => w.id === cookieWorkspaceId) || SEED_WORKSPACES[0];

  return {
    userId: user ? user.id : null,
    userName: resolvedName,
    userEmail: resolvedEmail,
    activeWorkspaceId: matchedSeed.id,
    activeWorkspaceName: matchedSeed.name,
    role: matchedSeed.role,
    availableWorkspaces: SEED_WORKSPACES,
  };
}
