'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waAccess } from '@/lib/wa/queries';
import { normalizeIdPhone } from '@/lib/wa/stats';

/** Settings of the sales bot. Finance roles only (the same people who can open WA Control). */
export async function saveBotConfig(patch: { enabled?: boolean; persona_name?: string; company_name?: string; hours_from?: string; hours_to?: string; max_replies?: number; knowledge?: string }) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const row: Record<string, unknown> = { workspace_id: ctx.activeWorkspaceId, updated_at: new Date().toISOString() };
  const time = (v: string | undefined) => (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined);
  if (typeof patch.enabled === 'boolean') row.enabled = patch.enabled;
  if (typeof patch.persona_name === 'string') { const v = patch.persona_name.trim().slice(0, 30); if (!v) return { error: 'The bot needs a name.' }; row.persona_name = v; }
  if (typeof patch.company_name === 'string') { const v = patch.company_name.trim().slice(0, 60); if (!v) return { error: 'The company name cannot be empty.' }; row.company_name = v; }
  if (patch.hours_from !== undefined) { const v = time(patch.hours_from); if (!v) return { error: 'Opening time must look like 08:00.' }; row.hours_from = v; }
  if (patch.hours_to !== undefined) { const v = time(patch.hours_to); if (!v) return { error: 'Closing time must look like 21:00.' }; row.hours_to = v; }
  if (patch.max_replies !== undefined) { const n = Math.round(Number(patch.max_replies)); if (!(n >= 1 && n <= 10)) return { error: 'Messages per chat must be 1 to 10.' }; row.max_replies = n; }
  if (typeof patch.knowledge === 'string') row.knowledge = patch.knowledge.slice(0, 12000);
  const { error } = await createAdminClient().from('wa_bot_config').upsert(row, { onConflict: 'workspace_id' });
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa/sales');
  return { ok: true };
}

/** A salesperson takes a chat from the bot ("human"), gives it back ("bot"), or switches the bot off for it ("off"). */
export async function setBotChatStatus(groupId: string, status: 'bot' | 'human' | 'off') {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  if (!['bot', 'human', 'off'].includes(status)) return { error: 'Unknown status.' };
  const db = createAdminClient();
  const { data: g } = await db.from('wa_groups').select('id').eq('id', groupId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!g) return { error: 'Chat not found.' };
  const { error } = await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ctx.activeWorkspaceId, status, reason: status === 'bot' ? null : 'Set by hand.', updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa/sales');
  return { ok: true };
}

/** Registers the sales number (the device row Fonnte's webhook points to). Its webhook link appears on the Sales page. */
export async function addSalesDevice(phoneRaw: string, label: string) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const phone = normalizeIdPhone(phoneRaw);
  if (!phone) return { error: 'That does not look like a WhatsApp number (62...).' };
  const db = createAdminClient();
  const { data: existing } = await db.from('wa_devices').select('id, role').eq('workspace_id', ctx.activeWorkspaceId).eq('phone', phone).maybeSingle();
  if (existing) {
    const { error } = await db.from('wa_devices').update({ role: 'sales', label: label.trim().slice(0, 40) || null, active: true }).eq('id', existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from('wa_devices').insert({ workspace_id: ctx.activeWorkspaceId, phone, label: label.trim().slice(0, 40) || 'Sales', role: 'sales', active: true });
    if (error) return { error: error.message };
  }
  revalidatePath('/hrd/wa/sales');
  return { ok: true };
}
