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

  // 1. Authenticated User flow
  if (user) {
    const { data: memberRows } = await supabaseClient
      .from('workspace_members')
      .select('workspace_id, role, workspaces (*)')
      .eq('user_id', user.id);

    if (memberRows && memberRows.length > 0) {
      const allowedWorkspaces: WorkspaceTenantInfo[] = memberRows.map((m: any) => ({
        id: m.workspace_id,
        name: m.workspaces?.name || 'Workspace Enterprise',
        role: (m.role as any) || 'accounting',
        logoUrl: m.workspaces?.company_logo_url || undefined,
      }));

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
        activeWorkspaceId: active.id,
        activeWorkspaceName: active.name,
        role: active.role,
        availableWorkspaces: allowedWorkspaces,
      };
    }
  }

  // 2. Fallback Seed / Preview Flow (Supports multi-tenant switching in development)
  const matchedSeed = SEED_WORKSPACES.find((w) => w.id === cookieWorkspaceId) || SEED_WORKSPACES[0];

  return {
    userId: user ? user.id : null,
    activeWorkspaceId: matchedSeed.id,
    activeWorkspaceName: matchedSeed.name,
    role: matchedSeed.role,
    availableWorkspaces: SEED_WORKSPACES,
  };
}
