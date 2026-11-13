import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendWhatsApp } from '@/lib/wa/send';
import { conversationsOf, countsOf, filterConversations, threadOf, type BotChatRow, type ChatFilter, type ChatGroupRow, type ChatMessageRow } from './shape';

/** Database reads and writes of the chat dashboard API (server only). The sales number's private chats only: never groups, never the admin number. */

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** The sales device's private chats of a company. */
async function salesGroups(ws: string): Promise<{ groups: ChatGroupRow[]; phone: string | null }> {
  const db = createAdminClient();
  const { data: devs } = await db.from('wa_devices').select('id, phone').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  const ids = (devs || []).map((d: any) => d.id as string);
  if (!ids.length) return { groups: [], phone: null };
  const { data: groups } = await db.from('wa_groups').select('id, wa_id, name, last_message_at').eq('workspace_id', ws).eq('is_group', false).in('device_id', ids).order('last_message_at', { ascending: false, nullsFirst: false }).limit(300);
  return { groups: (groups || []) as ChatGroupRow[], phone: (devs as any[])[0].phone as string };
}

export async function listConversations(ws: string, filter: ChatFilter, q: string) {
  const db = createAdminClient();
  const { groups } = await salesGroups(ws);
  if (!groups.length) return { conversations: [], counts: { all: 0, unserved: 0, bot: 0, human: 0 } };
  const ids = groups.map((g) => g.id);
  const [{ data: msgs }, { data: bot }] = await Promise.all([
    db.from('wa_messages').select('id, group_id, body, media_type, is_from_me, sent_at').eq('workspace_id', ws).in('group_id', ids).order('sent_at', { ascending: false }).limit(1500),
    db.from('wa_bot_chats').select('group_id, status, replies, reason, lead').eq('workspace_id', ws).in('group_id', ids),
  ]);
  const all = conversationsOf(groups, (msgs || []) as ChatMessageRow[], (bot || []) as BotChatRow[]).filter((c) => c.lastAt);
  return { conversations: filterConversations(all, filter, q), counts: countsOf(all) };
}

/** One chat: its messages, the bot state and log, and what the ERP knows about this number (a client and its deals). */
export async function loadThread(ws: string, groupId: string) {
  const db = createAdminClient();
  const { groups } = await salesGroups(ws);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return null;
  const [{ data: msgs }, { data: bot }, { data: log }, { data: clients }] = await Promise.all([
    db.from('wa_messages').select('id, group_id, body, media_type, is_from_me, sent_at, raw').eq('group_id', groupId).order('sent_at', { ascending: false }).limit(200),
    db.from('wa_bot_chats').select('group_id, status, replies, reason, lead').eq('group_id', groupId).maybeSingle(),
    db.from('wa_bot_log').select('reply, handoff, ok, detail, created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(30),
    db.from('clients').select('id, name, phone, sales_name, service_end_date').eq('workspace_id', ws).not('phone', 'is', null).limit(3000),
  ]);
  const tail = (s: string) => digits(s).slice(-9);
  const client = (clients || []).find((c: any) => tail(c.phone).length >= 8 && tail(c.phone) === tail(group.wa_id)) || null;
  let deals: any[] = [];
  if (client) ({ data: deals } = await db.from('crm_deals').select('id, title, stage, value, salesman_name').eq('client_id', (client as any).id).order('created_at', { ascending: false }).limit(5) as any);
  const botReplies = (log || []).filter((l: any) => l.reply).map((l: any) => String(l.reply));
  return {
    id: group.id, phone: group.wa_id, name: (group.name || '').trim() || `+${group.wa_id}`,
    messages: threadOf(((msgs || []) as ChatMessageRow[]), botReplies),
    bot: bot ? { status: (bot as any).status, replies: (bot as any).replies, reason: (bot as any).reason, lead: (bot as any).lead } : { status: 'new', replies: 0, reason: null, lead: null },
    botLog: (log || []).slice(0, 10),
    client: client ? { id: (client as any).id, name: (client as any).name, sales: (client as any).sales_name, serviceEnd: (client as any).service_end_date } : null,
    deals: (deals || []).map((d: any) => ({ id: d.id, title: d.title, stage: d.stage, value: Number(d.value || 0), sales: d.salesman_name })),
  };
}

export const MAX_REPLY_CHARS = 1500;

/** Sends a reply from the sales number, keeps it in the chat history, and hands the chat to a person (the bot stops). */
export async function sendReply(ws: string, groupId: string, text: string, by: { userId: string; name: string }): Promise<{ ok: true; message: { id: string; at: string } } | { ok: false; status: number; error: string }> {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return { ok: false, status: 400, error: 'Type a message first.' };
  if (clean.length > MAX_REPLY_CHARS) return { ok: false, status: 400, error: `The message is too long (max ${MAX_REPLY_CHARS} characters).` };
  const db = createAdminClient();
  const { groups, phone: devicePhone } = await salesGroups(ws);
  const group = groups.find((g) => g.id === groupId);
  if (!group || !devicePhone) return { ok: false, status: 404, error: 'Chat not found.' };
  if (!process.env.FONNTE_TOKEN_SALES) return { ok: false, status: 503, error: 'The sales number is not connected (FONNTE_TOKEN_SALES is missing on the server).' };

  const sent = await sendWhatsApp([group.wa_id], clean, { token: process.env.FONNTE_TOKEN_SALES });
  if (!sent.ok) return { ok: false, status: 502, error: sent.detail };

  const at = new Date().toISOString();
  const { data: row } = await db.from('wa_messages').insert({
    workspace_id: ws, group_id: groupId, sender_phone: devicePhone, sender_name: by.name, body: clean, is_from_me: true,
    dedupe_key: `dashboard:${crypto.randomUUID()}`, sent_at: at, source: 'dashboard', raw: { sentBy: { id: by.userId, name: by.name } },
  }).select('id').single();
  await db.from('wa_groups').update({ last_message_at: at }).eq('id', groupId);
  await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'human', reason: `${by.name} replied from the dashboard.`, updated_at: at }, { onConflict: 'group_id' });
  return { ok: true, message: { id: (row as any)?.id || '', at } };
}

export async function setChatStatus(ws: string, groupId: string, status: 'bot' | 'human' | 'off', by: string) {
  const db = createAdminClient();
  const { groups } = await salesGroups(ws);
  if (!groups.some((g) => g.id === groupId)) return { ok: false as const, status: 404, error: 'Chat not found.' };
  const { error } = await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status, reason: status === 'bot' ? null : `Set by ${by}.`, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
  return error ? { ok: false as const, status: 500, error: error.message } : { ok: true as const };
}
