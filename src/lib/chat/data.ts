import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendWhatsApp } from '@/lib/wa/send';
import { askBotModel } from '@/lib/wa/bot/model';
import { CHAT_ROLES } from './auth';
import { buildSuggestPrompt, cleanSuggestion } from './suggest';
import {
  cleanShortcut, conversationsOf, countsOf, filterConversations, threadOf,
  type BotChatRow, type ChatFilter, type ChatGroupRow, type ChatMessageRow, type ChatNoteRow, type ChatStateRow,
} from './shape';

/** Database reads and writes of the chat dashboard API (server only). The sales number's private chats only: never groups, never the admin number. */

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
type Who = { userId: string; name: string };
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

/** The sales device's private chats of a company. */
async function salesGroups(ws: string): Promise<{ groups: ChatGroupRow[]; phone: string | null }> {
  const db = createAdminClient();
  const { data: devs } = await db.from('wa_devices').select('id, phone').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  const ids = (devs || []).map((d: any) => d.id as string);
  if (!ids.length) return { groups: [], phone: null };
  const { data: groups } = await db.from('wa_groups').select('id, wa_id, name, last_message_at').eq('workspace_id', ws).eq('is_group', false).in('device_id', ids).order('last_message_at', { ascending: false, nullsFirst: false }).limit(300);
  return { groups: (groups || []) as ChatGroupRow[], phone: (devs as any[])[0].phone as string };
}

const ownGroup = async (ws: string, groupId: string) => (await salesGroups(ws)).groups.find((g) => g.id === groupId) || null;

export async function listConversations(ws: string, filter: ChatFilter, q: string, meId: string) {
  const db = createAdminClient();
  const { groups } = await salesGroups(ws);
  const none = { conversations: [], counts: { all: 0, mine: 0, unserved: 0, bot: 0, human: 0, resolved: 0 } };
  if (!groups.length) return none;
  const ids = groups.map((g) => g.id);
  const [{ data: msgs }, { data: bot }, { data: states }] = await Promise.all([
    db.from('wa_messages').select('id, group_id, body, media_type, is_from_me, sent_at').eq('workspace_id', ws).in('group_id', ids).order('sent_at', { ascending: false }).limit(1500),
    db.from('wa_bot_chats').select('group_id, status, replies, reason, lead').eq('workspace_id', ws).in('group_id', ids),
    db.from('chat_state').select('group_id, assigned_to, assigned_name, resolved_at').eq('workspace_id', ws).in('group_id', ids),
  ]);
  const all = conversationsOf(groups, (msgs || []) as ChatMessageRow[], (bot || []) as BotChatRow[], (states || []) as ChatStateRow[]).filter((c) => c.lastAt);
  return { conversations: filterConversations(all, filter, q, meId), counts: countsOf(all, meId) };
}

/** One chat: its messages and internal notes, the bot state and log, who handles it, and what the ERP knows about this number (a client and its deals). */
export async function loadThread(ws: string, groupId: string) {
  const db = createAdminClient();
  const group = await ownGroup(ws, groupId);
  if (!group) return null;
  const [{ data: msgs }, { data: bot }, { data: log }, { data: clients }, { data: st }, { data: notes }] = await Promise.all([
    db.from('wa_messages').select('id, group_id, body, media_type, is_from_me, sent_at, raw').eq('group_id', groupId).order('sent_at', { ascending: false }).limit(200),
    db.from('wa_bot_chats').select('group_id, status, replies, reason, lead').eq('group_id', groupId).maybeSingle(),
    db.from('wa_bot_log').select('reply, handoff, ok, detail, created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(30),
    db.from('clients').select('id, name, phone, sales_name, service_end_date').eq('workspace_id', ws).not('phone', 'is', null).limit(3000),
    db.from('chat_state').select('group_id, assigned_to, assigned_name, resolved_at').eq('group_id', groupId).maybeSingle(),
    db.from('chat_notes').select('id, group_id, author_name, body, created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100),
  ]);
  const tail = (s: string) => digits(s).slice(-9);
  const client = (clients || []).find((c: any) => tail(c.phone).length >= 8 && tail(c.phone) === tail(group.wa_id)) || null;
  let deals: any[] = [];
  if (client) ({ data: deals } = await db.from('crm_deals').select('id, title, stage, value, salesman_name').eq('client_id', (client as any).id).order('created_at', { ascending: false }).limit(5) as any);
  const botReplies = (log || []).filter((l: any) => l.reply).map((l: any) => String(l.reply));
  const state = st as ChatStateRow | null;
  const lastLead = ((msgs || []) as ChatMessageRow[]).find((m) => !m.is_from_me);
  return {
    id: group.id, phone: group.wa_id, name: (group.name || '').trim() || `+${group.wa_id}`,
    messages: threadOf((msgs || []) as ChatMessageRow[], botReplies, (notes || []) as ChatNoteRow[]),
    bot: bot ? { status: (bot as any).status, replies: (bot as any).replies, reason: (bot as any).reason, lead: (bot as any).lead } : { status: 'new', replies: 0, reason: null, lead: null },
    botLog: (log || []).slice(0, 10),
    assignedTo: state?.assigned_to ? { id: state.assigned_to, name: state.assigned_name || 'Team' } : null,
    resolved: !!state?.resolved_at && !(lastLead && lastLead.sent_at > state.resolved_at),
    client: client ? { id: (client as any).id, name: (client as any).name, sales: (client as any).sales_name, serviceEnd: (client as any).service_end_date } : null,
    deals: (deals || []).map((d: any) => ({ id: d.id, title: d.title, stage: d.stage, value: Number(d.value || 0), sales: d.salesman_name })),
  };
}

export const MAX_REPLY_CHARS = 1500;

const upsertState = (ws: string, groupId: string, patch: Record<string, unknown>) =>
  createAdminClient().from('chat_state').upsert({ group_id: groupId, workspace_id: ws, updated_at: new Date().toISOString(), ...patch }, { onConflict: 'group_id' });

/** If nobody handles the chat yet, the person who acts on it takes it. A reply also reopens a resolved chat. */
async function claimIfFree(ws: string, groupId: string, by: Who, reopen: boolean) {
  const db = createAdminClient();
  const { data: st } = await db.from('chat_state').select('assigned_to').eq('group_id', groupId).maybeSingle();
  const patch: Record<string, unknown> = {};
  if (!st?.assigned_to) { patch.assigned_to = by.userId; patch.assigned_name = by.name; }
  if (reopen) { patch.resolved_at = null; patch.resolved_by = null; }
  if (Object.keys(patch).length) await upsertState(ws, groupId, patch);
}

/** Sends a reply from the sales number, keeps it in the chat history, takes the chat if it is free, and hands the chat to a person (the bot stops). */
export async function sendReply(ws: string, groupId: string, text: string, by: Who): Promise<{ ok: true; message: { id: string; at: string } } | Fail> {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return fail(400, 'Type a message first.');
  if (clean.length > MAX_REPLY_CHARS) return fail(400, `The message is too long (max ${MAX_REPLY_CHARS} characters).`);
  const db = createAdminClient();
  const { groups, phone: devicePhone } = await salesGroups(ws);
  const group = groups.find((g) => g.id === groupId);
  if (!group || !devicePhone) return fail(404, 'Chat not found.');
  if (!process.env.FONNTE_TOKEN_SALES) return fail(503, 'The sales number is not connected (FONNTE_TOKEN_SALES is missing on the server).');

  const sent = await sendWhatsApp([group.wa_id], clean, { token: process.env.FONNTE_TOKEN_SALES });
  if (!sent.ok) return fail(502, sent.detail);

  const at = new Date().toISOString();
  const { data: row } = await db.from('wa_messages').insert({
    workspace_id: ws, group_id: groupId, sender_phone: devicePhone, sender_name: by.name, body: clean, is_from_me: true,
    dedupe_key: `dashboard:${crypto.randomUUID()}`, sent_at: at, source: 'dashboard', raw: { sentBy: { id: by.userId, name: by.name } },
  }).select('id').single();
  await db.from('wa_groups').update({ last_message_at: at }).eq('id', groupId);
  await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'human', reason: `${by.name} replied from the dashboard.`, updated_at: at }, { onConflict: 'group_id' });
  await claimIfFree(ws, groupId, by, true);
  return { ok: true, message: { id: (row as any)?.id || '', at } };
}

export async function setChatStatus(ws: string, groupId: string, status: 'bot' | 'human' | 'off', by: Who): Promise<{ ok: true } | Fail> {
  if (!(await ownGroup(ws, groupId))) return fail(404, 'Chat not found.');
  const { error } = await createAdminClient().from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status, reason: status === 'bot' ? null : `Set by ${by.name}.`, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
  if (error) return fail(500, error.message);
  if (status === 'human') await claimIfFree(ws, groupId, by, false);          // "Take over" also makes it yours
  return { ok: true };
}

/** The people a chat can be given to: members of the company with a role that may use the dashboard. */
export async function listAgents(ws: string): Promise<Array<{ id: string; name: string; role: string }>> {
  const db = createAdminClient();
  const { data: members } = await db.from('workspace_members').select('user_id, role, email').eq('workspace_id', ws).in('role', [...CHAT_ROLES]).not('user_id', 'is', null);
  const ids = Array.from(new Set((members || []).map((m: any) => m.user_id as string)));
  const { data: profs } = ids.length ? await db.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
  const nameOf = (m: any) => String((profs || []).find((p: any) => p.id === m.user_id)?.full_name || '').trim() || String(m.email || '').split('@')[0] || 'Team';
  return (members || []).map((m: any) => ({ id: m.user_id as string, name: nameOf(m), role: String(m.role) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Gives the chat to a person (or to nobody, with userId null). */
export async function assignChat(ws: string, groupId: string, userId: string | null): Promise<{ ok: true; assignedTo: { id: string; name: string } | null } | Fail> {
  if (!(await ownGroup(ws, groupId))) return fail(404, 'Chat not found.');
  if (userId === null) { await upsertState(ws, groupId, { assigned_to: null, assigned_name: null }); return { ok: true, assignedTo: null }; }
  const agent = (await listAgents(ws)).find((a) => a.id === userId);
  if (!agent) return fail(400, 'That person cannot be given chats.');
  await upsertState(ws, groupId, { assigned_to: agent.id, assigned_name: agent.name });
  return { ok: true, assignedTo: { id: agent.id, name: agent.name } };
}

export async function resolveChat(ws: string, groupId: string, resolved: boolean, by: Who): Promise<{ ok: true } | Fail> {
  if (!(await ownGroup(ws, groupId))) return fail(404, 'Chat not found.');
  await upsertState(ws, groupId, resolved ? { resolved_at: new Date().toISOString(), resolved_by: by.name } : { resolved_at: null, resolved_by: null });
  return { ok: true };
}

export async function addNote(ws: string, groupId: string, text: string, by: Who): Promise<{ ok: true } | Fail> {
  const body = text.replace(/\r\n/g, '\n').trim();
  if (!body) return fail(400, 'Type the note first.');
  if (body.length > 2000) return fail(400, 'The note is too long (max 2000 characters).');
  if (!(await ownGroup(ws, groupId))) return fail(404, 'Chat not found.');
  const { error } = await createAdminClient().from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: by.userId, author_name: by.name, body });
  return error ? fail(500, error.message) : { ok: true };
}

// ---------------------------------------------------------------- quick replies
export interface QuickReply { id: string; shortcut: string; title: string; body: string }

export async function listQuickReplies(ws: string): Promise<QuickReply[]> {
  const { data } = await createAdminClient().from('chat_quick_replies').select('id, shortcut, title, body').eq('workspace_id', ws).order('shortcut');
  return (data || []) as QuickReply[];
}

export async function saveQuickReply(ws: string, input: { id?: string; shortcut: string; title: string; body: string }, by: Who): Promise<{ ok: true } | Fail> {
  const shortcut = cleanShortcut(input.shortcut);
  const title = String(input.title || '').trim().slice(0, 60);
  const body = String(input.body || '').replace(/\r\n/g, '\n').trim();
  if (!shortcut) return fail(400, 'The shortcut needs letters or numbers, like "harga".');
  if (!title) return fail(400, 'Give it a title.');
  if (!body) return fail(400, 'Type the message.');
  if (body.length > MAX_REPLY_CHARS) return fail(400, `The message is too long (max ${MAX_REPLY_CHARS} characters).`);
  const db = createAdminClient();
  const { data: clash } = await db.from('chat_quick_replies').select('id').eq('workspace_id', ws).eq('shortcut', shortcut).maybeSingle();
  if (clash && clash.id !== input.id) return fail(409, `The shortcut /${shortcut} is already used.`);
  const { error } = input.id
    ? await db.from('chat_quick_replies').update({ shortcut, title, body }).eq('id', input.id).eq('workspace_id', ws)
    : await db.from('chat_quick_replies').insert({ workspace_id: ws, shortcut, title, body, created_by: by.name });
  return error ? fail(500, error.message) : { ok: true };
}

export async function deleteQuickReply(ws: string, id: string): Promise<{ ok: true } | Fail> {
  const { error } = await createAdminClient().from('chat_quick_replies').delete().eq('id', id).eq('workspace_id', ws);
  return error ? fail(500, error.message) : { ok: true };
}

// ---------------------------------------------------------------- AI suggested reply
/** A draft reply for the salesperson to edit and send. Nothing is sent. */
export async function suggestReply(ws: string, groupId: string, by: Who): Promise<{ ok: true; text: string; model: string } | Fail> {
  if (!(await ownGroup(ws, groupId))) return fail(404, 'Chat not found.');
  const db = createAdminClient();
  const [{ data: cfg }, { data: msgs }] = await Promise.all([
    db.from('wa_bot_config').select('persona_name, company_name, knowledge').eq('workspace_id', ws).maybeSingle(),
    db.from('wa_messages').select('body, media_type, is_from_me, sent_at').eq('group_id', groupId).order('sent_at', { ascending: false }).limit(14),
  ]);
  const history = (msgs || []).reverse().map((m: any) => ({ from: (m.is_from_me ? 'team' : 'lead') as 'team' | 'lead', text: m.body || `(${m.media_type || 'pesan'})` }));
  if (!history.length) return fail(400, 'There is nothing to answer yet.');
  const { system, prompt } = buildSuggestPrompt({ persona: cfg?.persona_name || 'Fefe', company: cfg?.company_name || 'Prof Toko Online', knowledge: cfg?.knowledge || '', agentName: by.name, history });
  try {
    const out = await askBotModel(system, prompt);
    const text = cleanSuggestion(out.text, cfg?.knowledge || '');
    return text ? { ok: true, text, model: out.model } : fail(502, 'The AI did not write anything. Try again.');
  } catch (e: any) {
    return fail(502, `The AI could not answer: ${String(e?.message || e).slice(0, 160)}`);
  }
}
