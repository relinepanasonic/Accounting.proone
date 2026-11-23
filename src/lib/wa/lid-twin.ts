import { createAdminClient } from '@/lib/api/supabase-admin';
import type { ParsedWaMessage } from './parse-webhook';

/**
 * WhatsApp now hides some people's numbers behind an @lid identifier. For one message, Fonnte may send TWO calls: one with the hidden id (a 15-digit number that is
 * not a phone) and one with the real number. Each made its own chat, so the inbox showed a ghost chat "+210333943763069" next to the real one, unanswered.
 * The same text from both within a minute is one message: the hidden-id copy is dropped, whichever call came first.
 */
export const isLidId = (id: string | null | undefined) => /^\d{14,}$/.test(String(id ?? '')) && !/^62/.test(String(id ?? ''));
const WINDOW_MS = 90_000;

/** True when this message is the hidden-id copy of a message that already arrived with the real number: do not save it. */
export async function isLidDuplicate(deviceId: string, m: ParsedWaMessage): Promise<boolean> {
  if (m.isGroup || m.isFromMe || !isLidId(m.chatId) || !m.body) return false;
  const db = createAdminClient();
  const since = new Date(m.sentAt.getTime() - WINDOW_MS).toISOString();
  const { data } = await db.from('wa_messages').select('id, wa_groups!inner(wa_id, device_id)').eq('body', m.body).eq('is_from_me', false).eq('wa_groups.device_id', deviceId).gte('sent_at', since).limit(20);
  return ((data || []) as any[]).some((r) => { const g = Array.isArray(r.wa_groups) ? r.wa_groups[0] : r.wa_groups; return g && !isLidId(g.wa_id); });
}

/** After a message with the REAL number is saved: remove the hidden-id copy that arrived just before it (and its chat, when nothing else is in it). */
export async function removeLidTwin(deviceId: string, m: ParsedWaMessage): Promise<number> {
  if (m.isGroup || m.isFromMe || isLidId(m.chatId) || !m.body) return 0;
  const db = createAdminClient();
  const since = new Date(m.sentAt.getTime() - WINDOW_MS).toISOString();
  const { data } = await db.from('wa_messages').select('id, group_id, wa_groups!inner(wa_id, device_id)').eq('body', m.body).eq('is_from_me', false).eq('wa_groups.device_id', deviceId).gte('sent_at', since).limit(20);
  let removed = 0;
  for (const r of (data || []) as any[]) {
    const g = Array.isArray(r.wa_groups) ? r.wa_groups[0] : r.wa_groups;
    if (!g || !isLidId(g.wa_id)) continue;
    await db.from('wa_messages').delete().eq('id', r.id);
    removed++;
    const { count } = await db.from('wa_messages').select('id', { count: 'exact', head: true }).eq('group_id', r.group_id);
    if ((count ?? 0) === 0) await db.from('wa_groups').delete().eq('id', r.group_id);
  }
  return removed;
}
