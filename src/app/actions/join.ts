'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { hashInviteToken } from '@/lib/auth/invites';

export interface JoinResult {
  success: false;
  error: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

/**
 * The person opens their invitation link and creates their own account. The invitation decides the name,
 * role and workspaces; they choose email, phone, username and password.
 */
export async function completeInvite(
  token: string,
  input: { email: string; phone: string; username: string; password: string }
): Promise<JoinResult> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const phone = input.phone.replace(/[\s()-]/g, '');
  const password = input.password;

  if (!EMAIL_RE.test(email)) return { success: false, error: 'Please enter a valid email address.' };
  if (!/^\+?\d{8,15}$/.test(phone)) return { success: false, error: 'Please enter a valid phone number (digits only, 8 to 15 long).' };
  if (!USERNAME_RE.test(username)) return { success: false, error: 'Username: 3 to 30 characters, lowercase letters, numbers, dot, dash or underscore.' };
  if (password.length < 8) return { success: false, error: 'Password must be at least 8 characters.' };

  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const tokenHash = hashInviteToken(token);

  const { data: invite } = await db
    .from('workspace_invites')
    .select('id, full_name, role, workspace_ids, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!invite || invite.used_at || new Date(invite.expires_at).getTime() < Date.now()) {
    return { success: false, error: 'This invitation is no longer valid. Ask your admin for a new link.' };
  }

  const { data: taken } = await db.from('profiles').select('id, email').eq('username', username).maybeSingle();
  if (taken && (taken.email || '').toLowerCase() !== email) {
    return { success: false, error: 'That username is already taken. Please choose another.' };
  }

  // Claim the invitation first so two people cannot use the same link at once.
  const { data: claimed } = await db
    .from('workspace_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('used_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) {
    return { success: false, error: 'This invitation was just used. Ask your admin for a new link.' };
  }
  const release = () => db.from('workspace_invites').update({ used_at: null }).eq('id', invite.id);

  let userId: string;
  let isExisting = false;

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: invite.full_name, username, phone },
  });

  if (created?.user) {
    userId = created.user.id;
  } else {
    const already = /already|registered|exists/i.test(createError?.message || '');
    if (!already) {
      await release();
      return { success: false, error: createError?.message || 'Could not create your account.' };
    }

    // The email already has a login (for example someone removed from the team earlier and invited again).
    // Removing a member only takes away workspace access; the login stays. They can come back by proving it is
    // theirs with that account's current password. Their existing password is kept.
    const verifier = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signedIn, error: passwordError } = await verifier.auth.signInWithPassword({ email, password });
    if (passwordError || !signedIn?.user) {
      await release();
      return {
        success: false,
        error: "This email already has an account. Enter that account's existing password to join, or use a different email.",
      };
    }
    userId = signedIn.user.id;
    isExisting = true;
  }

  // Profile (phone is optional so this still works before the phone column exists).
  const { data: existingProfile } = await db.from('profiles').select('username, full_name').eq('id', userId).maybeSingle();
  const profile = {
    id: userId,
    email,
    username: existingProfile?.username || username,
    full_name: existingProfile?.full_name || invite.full_name,
  };
  let { error: profileError } = await db.from('profiles').upsert({ ...profile, phone }, { onConflict: 'id' });
  if (profileError && (profileError.code === '42703' || profileError.code === 'PGRST204' || /phone/.test(profileError.message))) {
    ({ error: profileError } = await db.from('profiles').upsert(profile, { onConflict: 'id' }));
  }
  if (profileError) console.error('Profile upsert error:', profileError);

  const { error: memberError } = await db.from('workspace_members').upsert(
    (invite.workspace_ids as string[]).map((workspaceId) => ({
      workspace_id: workspaceId,
      user_id: userId,
      role: invite.role,
      email,
      display_name: invite.full_name,
    })),
    { onConflict: 'workspace_id,user_id' }
  );
  if (memberError) {
    console.error('Member upsert error:', memberError);
    if (!isExisting) await db.auth.admin.deleteUser(userId);
    await release();
    return { success: false, error: 'Could not set up your workspace access. Please try again.' };
  }

  await db.from('workspace_invites').update({ used_by: userId }).eq('id', invite.id);

  // Sign them in right away.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  revalidatePath('/', 'layout');
  redirect(signInError ? '/login' : '/workspaces');
}
