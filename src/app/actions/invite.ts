'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { hashInviteToken, INVITE_ROLES, INVITE_TTL_DAYS, newInviteToken } from '@/lib/auth/invites';

const admin = () =>
  createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Creates a one-time invitation link. The admin only gives a name, a role and the workspaces; the person
 * fills in email, phone, username and password themselves when they open the link.
 */
export async function createInvite(input: {
  fullName: string;
  role: string;
  workspaceIds: string[];
}): Promise<{ success?: boolean; link?: string; inviteId?: string; expiresAt?: string; error?: string }> {
  const ctx = await getAuthenticatedWorkspaceContext();

  if (!['superadmin', 'founder'].includes(ctx.role)) {
    return { error: 'Unauthorized: only superadmins can invite users.' };
  }
  if (!(INVITE_ROLES as readonly string[]).includes(input.role)) return { error: 'Invalid role.' };

  const fullName = input.fullName.trim();
  if (fullName.length < 2) return { error: 'Please enter the person\'s name.' };

  // Only workspaces where the inviter is founder / superadmin can be granted.
  const grantable = new Set(ctx.availableWorkspaces.filter((w) => w.role === 'founder' || w.role === 'superadmin').map((w) => w.id));
  const requested = input.workspaceIds.length > 0 ? input.workspaceIds : [ctx.activeWorkspaceId];
  const workspaceIds = Array.from(new Set(requested.filter((id) => grantable.has(id))));
  if (workspaceIds.length === 0) return { error: 'Choose at least one workspace you manage.' };

  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();

  const { data, error } = await admin()
    .from('workspace_invites')
    .insert({
      token_hash: hashInviteToken(token),
      full_name: fullName,
      role: input.role,
      workspace_ids: workspaceIds,
      invited_by: ctx.userId,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return { error: 'Invitations are not set up yet: run supabase/migrations/20260930_workspace_invites.sql in Supabase.' };
    }
    return { error: error.message };
  }

  // SITE_URL (e.g. https://accounting.profesoronline.id) wins so the link always points at the real domain.
  const h = await headers();
  const siteUrl = (process.env.SITE_URL || `${h.get('x-forwarded-proto') || 'http'}://${h.get('host') || 'localhost:3000'}`).replace(/\/$/, '');

  revalidatePath('/settings/team');
  return { success: true, link: `${siteUrl}/join/${token}`, inviteId: data.id, expiresAt };
}

/** Cancels an invitation that has not been used yet. */
export async function revokeInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthenticatedWorkspaceContext();
  if (!['superadmin', 'founder'].includes(ctx.role)) return { success: false, error: 'Unauthorized.' };

  const db = admin();
  const { data: invite } = await db.from('workspace_invites').select('id, workspace_ids, used_at').eq('id', inviteId).maybeSingle();
  if (!invite) return { success: false, error: 'Invitation not found.' };
  if (invite.used_at) return { success: false, error: 'This invitation was already used.' };

  const grantable = new Set(ctx.availableWorkspaces.filter((w) => w.role === 'founder' || w.role === 'superadmin').map((w) => w.id));
  if (!(invite.workspace_ids as string[]).some((id) => grantable.has(id))) {
    return { success: false, error: 'You do not manage this invitation.' };
  }

  const { error } = await db.from('workspace_invites').delete().eq('id', inviteId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/settings/team');
  return { success: true };
}
