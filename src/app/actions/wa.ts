'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waAccess } from '@/lib/wa/queries';
import { normalizeIdPhone } from '@/lib/wa/stats';

/**
 * Links a WhatsApp number to an ERP person (so their chats count for their role),
 * or, with no userId, marks the number as "not staff" again. Finance roles only.
 */
export async function linkWaNumber(phoneRaw: string, userId: string | null, displayName?: string) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const phone = normalizeIdPhone(phoneRaw);
  if (!phone) return { error: 'Missing phone' };
  const db = createAdminClient();

  if (userId) {
    // Only someone who really belongs to this company can be linked.
    const { data: member } = await db.from('workspace_members').select('user_id').eq('workspace_id', ctx.activeWorkspaceId).eq('user_id', userId).maybeSingle();
    if (!member) return { error: 'That person is not in this company' };
    // One number per person: free any other number this person had.
    await db.from('wa_members').update({ user_id: null, is_team: false }).eq('workspace_id', ctx.activeWorkspaceId).eq('user_id', userId).neq('phone', phone);
  }
  const { error } = await db.from('wa_members').upsert(
    { workspace_id: ctx.activeWorkspaceId, phone, user_id: userId, is_team: !!userId, ...(displayName ? { display_name: displayName } : {}) },
    { onConflict: 'workspace_id,phone' },
  );
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** Turns reporting on or off for one group (its messages are still stored). */
export async function setWaGroupTracked(groupId: string, tracked: boolean) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const { error } = await createAdminClient().from('wa_groups').update({ tracked }).eq('id', groupId).eq('workspace_id', ctx.activeWorkspaceId);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}
