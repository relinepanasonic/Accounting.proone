import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

/** AI Office is for the founder and superadmins only. Returns null for anyone else. */
export async function getOfficeAccess() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || !ctx.activeWorkspaceId) return null;
  if (ctx.role !== 'founder' && ctx.role !== 'superadmin') return null;
  return { supabase, workspaceId: ctx.activeWorkspaceId, userId: ctx.userId };
}
