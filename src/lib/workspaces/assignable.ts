import { createAdminClient } from '@/lib/api/supabase-admin';
import type { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

type Ctx = Awaited<ReturnType<typeof getAuthenticatedWorkspaceContext>>;

/**
 * The companies someone may hand an expense or an invoice to from PT Pintu.
 * The founder can choose every company (PLIG, ProOne, NW, DOA...). Everyone else, superadmins included, only the companies they belong to.
 */
export async function assignableWorkspaces(ctx: Pick<Ctx, 'role' | 'availableWorkspaces'>): Promise<Array<{ id: string; name: string }>> {
  const own = ctx.availableWorkspaces.map((w) => ({ id: w.id, name: w.name }));
  if (ctx.role !== 'founder') return own;
  try {
    const { data } = await createAdminClient().from('workspaces').select('id, name').order('name');
    return (data || []).length ? (data as Array<{ id: string; name: string }>) : own;
  } catch {
    return own;
  }
}
