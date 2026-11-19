import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendWhatsApp } from '@/lib/wa/send';
import { jakartaMidnight } from './broadcast-rules';
import { normalizePhone } from './sales-team';

/**
 * A new chat started from the dashboard: the team writes the first message to a number (an introduction, a follow-up of a lead from a call or an event) and it is
 * sent from the sales number AND kept here, so the chat is in the inbox from the first message, and the reply of the person lands in it.
 * Why: Fonnte only tells us about INCOMING messages. A message typed by hand on the phone is never seen by this system, so those chats stay out of the inbox
 * until the person answers (and then the first message is missing).
 * Safety: at most NEW_CHAT_MAX_PER_DAY first messages a day to numbers we never wrote to (WhatsApp is strict with numbers that have not saved ours), never to a
 * number that said STOP, never to the sales number itself.
 */
export const NEW_CHAT_MAX_PER_DAY = 20;
export const NEW_CHAT_MAX_CHARS = 1500;

type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

/** The number and the message, checked. */
export function cleanNewChat(i: any): { ok: true; phone: string; text: string } | { ok: false; error: string } {
  const raw = String(i?.phone ?? '').trim();
  if (!raw) return { ok: false, error: 'Write the WhatsApp number, for example 0812 3456 7890.' };
  const phone = normalizePhone(raw);
  if (!phone || phone.length < 10 || phone.length > 15) return { ok: false, error: 'The number looks wrong. Write it like 0812 3456 7890.' };
  const text = String(i?.text ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, error: 'Write the first message.' };
  if (text.length > NEW_CHAT_MAX_CHARS) return { ok: false, error: `The message is too long (max ${NEW_CHAT_MAX_CHARS} characters).` };
  return { ok: true, phone, text };
}

export async function startChat(ws: string, input: unknown, by: { userId: string; name: string }, now = new Date()): Promise<{ ok: true; id: string; isNew: boolean } | Fail> {
  const c = cleanNewChat(input);
  if (!c.ok) return fail(400, c.error);
  const db = createAdminClient();
  if (!process.env.FONNTE_TOKEN_SALES) return fail(502, 'The sales number is not connected (FONNTE_TOKEN_SALES is missing on the server).');

  const { data: devs } = await db.from('wa_devices').select('id, phone').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  const device = ((devs || []) as Array<{ id: string; phone: string }>).find((d) => !/^(ig|fb):/.test(d.phone));
  if (!device) return fail(409, 'No WhatsApp sales number is set up.');
  if (device.phone === c.phone) return fail(400, 'That is the sales number itself.');

  const { data: out } = await db.from('chat_optouts').select('wa_id').eq('workspace_id', ws).eq('wa_id', c.phone).maybeSingle();
  if (out) return fail(409, 'This person asked not to be contacted (STOP or "do not disturb"). Nothing is sent to this number.');

  // the chat of this number (made when there is none)
  const { data: existing } = await db.from('wa_groups').select('id').eq('workspace_id', ws).eq('wa_id', c.phone).maybeSingle();
  let groupId = (existing as any)?.id as string | undefined;
  let isNew = true;
  if (groupId) { const { count } = await db.from('wa_messages').select('id', { count: 'exact', head: true }).eq('group_id', groupId); isNew = (count ?? 0) === 0; }

  // a number we never wrote to: a daily limit, so the sales number is not flagged
  if (isNew) {
    const { count } = await db.from('wa_messages').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('source', 'dashboard').eq('is_from_me', true).contains('raw', { newChat: true }).gte('sent_at', jakartaMidnight(now).toISOString());
    if ((count ?? 0) >= NEW_CHAT_MAX_PER_DAY) return fail(429, `The limit of ${NEW_CHAT_MAX_PER_DAY} new chats a day is reached. WhatsApp is strict with numbers that have not saved ours: continue tomorrow.`);
  }

  const sent = await sendWhatsApp([c.phone], c.text, { token: process.env.FONNTE_TOKEN_SALES });
  if (!sent.ok) return fail(502, sent.detail);

  const at = now.toISOString();
  if (!groupId) {
    const { data: g, error } = await db.from('wa_groups').upsert({ workspace_id: ws, device_id: device.id, wa_id: c.phone, is_group: false, last_message_at: at }, { onConflict: 'workspace_id,wa_id' }).select('id').single();
    if (error || !g) return fail(500, error?.message || 'Could not save the chat.');
    groupId = (g as any).id as string;
  } else await db.from('wa_groups').update({ last_message_at: at }).eq('id', groupId);
  await db.from('wa_messages').insert({ workspace_id: ws, group_id: groupId, sender_phone: device.phone, sender_name: by.name, body: c.text, is_from_me: true, dedupe_key: `dashboard:${crypto.randomUUID()}`, sent_at: at, source: 'dashboard', raw: { sentBy: { id: by.userId, name: by.name }, newChat: isNew } });
  // the chat is the sender's, and a person (not the bot) answers it
  await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'human', reason: `${by.name} started this chat from the dashboard.`, updated_at: at }, { onConflict: 'group_id' });
  await db.from('chat_state').upsert({ group_id: groupId, workspace_id: ws, assigned_to: by.userId, assigned_name: by.name, resolved_at: null, updated_at: at }, { onConflict: 'group_id' });
  return { ok: true, id: groupId, isNew };
}
