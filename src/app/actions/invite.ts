'use server';

import { headers } from 'next/headers';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export async function generateInviteLink(formData: {
  email: string;
  username: string;
  fullName: string;
  role: string;
}): Promise<{ success?: boolean; link?: string; error?: string }> {
  const wsCtx = await getAuthenticatedWorkspaceContext();

  if (!['superadmin', 'founder'].includes(wsCtx.role)) {
    return { error: 'Unauthorized: only superadmins can invite users.' };
  }

  if (!['superadmin', 'accounting', 'admin', 'advertiser', 'client'].includes(formData.role)) {
    return { error: 'Invalid role.' };
  }

  if (!formData.email || !formData.username || !formData.fullName) {
    return { error: 'Email, username and name are all required.' };
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Derive the site URL from the incoming request headers — works on any host with no env var needed.
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const proto = headersList.get('x-forwarded-proto') || 'http';
  // SITE_URL (e.g. https://accounting.profesoronline.id) wins so links generated anywhere point at the real domain.
  const siteUrl = (process.env.SITE_URL || `${proto}://${host}`).replace(/\/$/, '');
  const redirectTo = `${siteUrl}/auth/confirm`;

  // 1. Generate an invite link via Supabase Admin API
  const { data, error: genError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: formData.email.toLowerCase().trim(),
    options: {
      redirectTo,
    },
  });

  if (genError || !data?.user) {
    return { error: genError?.message || 'Failed to generate invite link.' };
  }

  const newUserId = data.user.id;

  // 2. Create or update the profile with username and full name
  const { error: profileError } = await adminClient.from('profiles').upsert(
    {
      id: newUserId,
      email: formData.email.toLowerCase().trim(),
      username: formData.username.trim(),
      full_name: formData.fullName.trim(),
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    console.error('Profile upsert error:', profileError);
    // Non-fatal: continue
  }

  // 3. Add the user to the current workspace with the assigned role
  const { error: memberError } = await adminClient.from('workspace_members').upsert(
    {
      workspace_id: wsCtx.activeWorkspaceId,
      user_id: newUserId,
      role: formData.role,
      email: formData.email.toLowerCase().trim(),
      display_name: formData.fullName.trim(),
    },
    { onConflict: 'workspace_id,user_id' }
  );

  if (memberError) {
    console.error('Member upsert error:', memberError);
    return { error: memberError.message };
  }

  // Build the link on OUR domain instead of returning Supabase's action_link (…supabase.co/auth/v1/verify).
  // /auth/confirm verifies the token server-side, so no Supabase redirect allow-list is involved either.
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    return { error: 'Failed to generate invite link.' };
  }

  return {
    success: true,
    link: `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=invite`,
  };
}
