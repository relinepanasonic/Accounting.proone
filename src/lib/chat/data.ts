import { createAdminClient } from '@/lib/api/supabase-admin';
import { memo } from './cache';
import { loadKnowledge } from './bible';
import { syncClientSource } from './sources';
import { chatReminders, inboxExtras, listLabels, mediaEnabled, signMedia } from './crm-data';
import { sendToChat } from './send-any';
import { chatLabel, phoneTail } from './channel';
import { askBotModel } from '@/lib/wa/bot/model';
import { CHAT_ROLES } from './auth';
import { buildSuggestPrompt, cleanSuggestion } from './suggest';
import { upcomingFor } from './meetings';
import { paymentOf } from './payment-status';
import { PIPELINE_STAGES } from '@/lib/sales/flow';
import {
  cleanShortcut, conversationsOf, countsOf, filterConversations, sourceOf, threadOf,
  type BotChatRow, type ChatFilter, type ChatGroupRow, type ChatMessageRow, type ChatNoteRow, type ChatStateRow,
} from './shape';

/** Database reads and writes of the chat dashboard API (server only). The sales number's private chats only: never groups, never the admin number. */

type Who = { userId: string; name: string };
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

/** The company's sales device(s): they change almost never, so they are kept for 30 seconds. */
const salesDevices = (ws: string) => memo(`devices:${ws}`, 30_000, async () => {
  const { data } = await createAdminClient().from('wa_devices').select('id, phone').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  return (data || []) as Array<{ id: string; phone: string }>;
});

/** The sales device's private chats of a company. */
async function salesGroups(ws: string): Promise<{ groups: ChatGroupRow[]; phone: string | null }> {
  const db = createAdminClient();
  const devs = await salesDevices(ws);
  const ids = devs.map((d) => d.id);
  if (!ids.length) return { groups: [], phone: null };
  const { data: groups } = await db.from('wa_groups').select('id, wa_id, name, last_message_at').eq('workspace_id', ws).eq('is_group', false).in('device_id', ids).order('last_message_at', { ascending: false, nullsFirst: false }).limit(300);
  return { groups: (groups || []) as ChatGroupRow[], phone: devs[0].phone };
}

/** One chat of the sales number, checked with a single small query (not by loading every chat). */
const ownGroup = async (ws: string, groupId: string): Promise<ChatGroupRow | null> => {
  const ids = (await salesDevices(ws)).map((d) => d.id);
  if (!ids.length) return null;
  const { data } = await createAdminClient().from('wa_groups').select('id, wa_id, name, last_message_at').eq('id', groupId).eq('workspace_id', ws).eq('is_group', false).in('device_id', ids).maybeSingle();
  return (data as ChatGroupRow | null) ?? null;
};

/** The ERP client whose phone number is this WhatsApp number (compared on the last 9 digits), or null. */
export async function findClientByPhone(ws: string, waId: string): Promise<{ id: string; name: string; sales_name: string | null } | null> {
  const t = phoneTail(waId);
  if (t.length < 8) return null;
  const hit = (await clientPhones(ws)).find((c: any) => phoneTail(c.phone) === t);
  return hit ? { id: hit.id, name: hit.name, sales_name: hit.sales_name ?? null } : null;
}

/** The phone numbers of the company's clients (to show the client next to a chat): kept for 5 minutes instead of reading thousands of rows on every poll. */
const clientPhones = (ws: string) => memo(`clients:${ws}`, 300_000, async () => {
  const { data } = await createAdminClient().from('clients').select('id, name, phone, sales_name, service_end_date, lead_source, first_contact_message').eq('workspace_id', ws).not('phone', 'is', null).limit(3000);
  return (data || []) as any[];
});

/**
 * The ERP deal of each chat, for the stage on the inbox list: the deal the chat is linked to (made from the chat, works for Instagram and Messenger too),
 * else the newest deal of the client with the chat's phone number. With where its invoice stands.
 */
async function dealsOfChats(ws: string, groups: ChatGroupRow[], linked: Map<string, string | null>): Promise<Map<string, { id: string; stage: string; payment: ReturnType<typeof paymentOf> }>> {
  const db = createAdminClient();
  const out = new Map<string, { id: string; stage: string; payment: ReturnType<typeof paymentOf> }>();
  const clients = await clientPhones(ws);
  const clientOfTail = new Map<string, string>();
  for (const c of clients) { const t = phoneTail(c.phone); if (t.length >= 8 && !clientOfTail.has(t)) clientOfTail.set(t, c.id); }
  const clientOfGroup = new Map<string, string>();
  for (const g of groups) { const id = clientOfTail.get(phoneTail(g.wa_id)); if (id) clientOfGroup.set(g.id, id); }
  const dealIds = [...new Set([...linked.values()].filter(Boolean) as string[])];
  const clientIds = [...new Set(clientOfGroup.values())];
  if (!dealIds.length && !clientIds.length) return out;
  const [byId, byClient] = await Promise.all([
    dealIds.length ? db.from('crm_deals').select('id, client_id, stage, invoice_id, created_at').in('id', dealIds) : Promise.resolve({ data: [] as any[] }),
    clientIds.length ? db.from('crm_deals').select('id, client_id, stage, invoice_id, created_at').in('client_id', clientIds).order('created_at', { ascending: false }).limit(3000) : Promise.resolve({ data: [] as any[] }),
  ]);
  const idMap = new Map<string, any>(((byId.data || []) as any[]).map((d) => [d.id, d]));
  const newest = new Map<string, any>();
  for (const d of (byClient.data || []) as any[]) if (!newest.has(d.client_id)) newest.set(d.client_id, d);
  const invoiceIds = [...new Set([...idMap.values(), ...newest.values()].map((d) => d.invoice_id).filter(Boolean))];
  const { data: invs } = invoiceIds.length ? await db.from('invoices').select('id, status, total_amount, amount_paid, due_date').in('id', invoiceIds) : { data: [] as any[] };
  const invOf = new Map<string, any>(((invs || []) as any[]).map((i) => [i.id, i]));
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  for (const g of groups) {
    const d = (linked.get(g.id) && idMap.get(linked.get(g.id)!)) || newest.get(clientOfGroup.get(g.id) || '');
    if (d) out.set(g.id, { id: d.id, stage: d.stage, payment: d.invoice_id ? paymentOf(invOf.get(d.invoice_id), today) : null });
  }
  return out;
}

export interface BoardDeal {
  id: string; title: string; client: string; stage: string; value: number;
  sales: string | null; salesId: string | null; groupId: string | null;
  daysInStage: number; payment: ReturnType<typeof paymentOf>; nextMeetingAt: string | null;
}

/**
 * The pipeline board of the chat dashboard: every open deal, plus the Active Clients and the Lost ones of the last 30 days, each with the chat it
 * belongs to (so a card opens its chat), how long it has been in its stage, its payment status and its next consultation. The same deals as the ERP board.
 */
export async function loadPipeline(ws: string): Promise<{ deals: BoardDeal[]; stages: string[] }> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const cols = 'id, title, client_id, lead_name, stage, value, salesman_id, salesman_name, created_at, stage_changed_at, invoice_id';
  const [{ data: open }, { data: recent }] = await Promise.all([
    db.from('crm_deals').select(cols).eq('workspace_id', ws).not('stage', 'in', '("Deal","Cold Case")').order('created_at', { ascending: false }).limit(1500),
    db.from('crm_deals').select(cols).eq('workspace_id', ws).in('stage', ['Deal', 'Cold Case']).gte('stage_changed_at', since).order('stage_changed_at', { ascending: false }).limit(300),
  ]);
  const rows = [...((open || []) as any[]), ...((recent || []) as any[])];
  if (!rows.length) return { deals: [], stages: [] };
  const ids = rows.map((d) => d.id as string);
  const clientIds = [...new Set(rows.map((d) => d.client_id).filter(Boolean))] as string[];
  const [{ groups }, clients, { data: links }, { data: invs }, { data: ms }, { data: cn }] = await Promise.all([
    salesGroups(ws),
    clientPhones(ws),
    db.from('chat_state').select('group_id, deal_id').eq('workspace_id', ws).in('deal_id', ids),
    db.from('invoices').select('id, status, total_amount, amount_paid, due_date').in('id', rows.map((d) => d.invoice_id).filter(Boolean)),
    db.from('chat_meetings').select('group_id, starts_at').eq('workspace_id', ws).eq('status', 'booked').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(500),
    clientIds.length ? db.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const nameOf = new Map<string, string>(((cn || []) as any[]).map((c) => [c.id, String(c.name || '')]));
  const groupOfDeal = new Map<string, string>(((links || []) as any[]).map((l) => [l.deal_id as string, l.group_id as string]));
  const groupOfTail = new Map<string, string>();
  for (const g of groups) { const t = phoneTail(g.wa_id); if (t.length >= 8 && !groupOfTail.has(t)) groupOfTail.set(t, g.id); }
  const phoneOfClient = new Map<string, string>(clients.map((c: any) => [c.id as string, phoneTail(c.phone)]));
  const invOf = new Map<string, any>(((invs || []) as any[]).map((i) => [i.id, i]));
  const nextMeet = new Map<string, string>();
  for (const m of (ms || []) as any[]) if (m.group_id && !nextMeet.has(m.group_id)) nextMeet.set(m.group_id, m.starts_at);
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const day = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const deals: BoardDeal[] = rows.map((d) => {
    const groupId = groupOfDeal.get(d.id) || groupOfTail.get(phoneOfClient.get(d.client_id) || '') || null;
    const since = day(d.stage_changed_at || d.created_at);
    return {
      id: d.id, title: String(d.title || 'Deal'), client: nameOf.get(d.client_id) || d.lead_name || 'Client', stage: d.stage, value: Number(d.value || 0),
      sales: d.salesman_name ?? null, salesId: d.salesman_id ?? null, groupId,
      daysInStage: Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${since}T12:00:00Z`)) / 86400000)),
      payment: d.invoice_id ? paymentOf(invOf.get(d.invoice_id), today) : null, nextMeetingAt: groupId ? nextMeet.get(groupId) ?? null : null,
    };
  });
  return { deals, stages: [...PIPELINE_STAGES] };
}

export async function listConversations(ws: string, filter: ChatFilter, q: string, meId: string, labelId = '', stage = '') {
  const db = createAdminClient();
  const { groups } = await salesGroups(ws);
  const none = { conversations: [], counts: { all: 0, mine: 0, unserved: 0, bot: 0, human: 0, resolved: 0, followup: 0 }, labels: await listLabels(ws), features: { media: await mediaEnabled(ws) } };
  if (!groups.length) return none;
  const ids = groups.map((g) => g.id);
  const [{ data: msgs }, { data: bot }, { data: states }] = await Promise.all([
    db.from('wa_messages').select('id, group_id, body, media_type, is_from_me, sent_at').eq('workspace_id', ws).in('group_id', ids).order('sent_at', { ascending: false }).limit(1500),
    db.from('wa_bot_chats').select('group_id, status, replies, reason, lead').eq('workspace_id', ws).in('group_id', ids),
    db.from('chat_state').select('group_id, assigned_to, assigned_name, resolved_at, first_message, source_label, source_channel, source_by, deal_id').eq('workspace_id', ws).in('group_id', ids),
  ]);
  const all = conversationsOf(groups, (msgs || []) as ChatMessageRow[], (bot || []) as BotChatRow[], (states || []) as ChatStateRow[]).filter((c) => c.lastAt);
  const extra = await inboxExtras(ws, all.map((c) => c.id));
  const deals = await dealsOfChats(ws, groups, new Map(((states || []) as any[]).map((s) => [s.group_id as string, (s.deal_id as string | null) ?? null]))).catch(() => new Map());
  for (const c of all) { c.labels = extra.labels.get(c.id) || []; c.nextReminder = extra.reminders.get(c.id) ?? null; const d = deals.get(c.id); c.stage = d?.stage ?? null; c.payment = d?.payment ?? null; }
  const byLabel = labelId ? all.filter((c) => (c.labels || []).some((l) => l.id === labelId)) : all;
  // a stage (the stored name), or "none" for chats without a deal
  const shown = stage ? byLabel.filter((c) => (stage === 'none' ? !c.stage : c.stage === stage)) : byLabel;
  return { conversations: filterConversations(shown, filter, q, meId), counts: countsOf(all, meId), labels: await listLabels(ws), features: { media: await mediaEnabled(ws) } };
}

/** One chat: its messages and internal notes, the bot state and log, who handles it, and what the ERP knows about this number (a client and its deals). */
export async function loadThread(ws: string, groupId: string) {
  const db = createAdminClient();
  const group = await ownGroup(ws, groupId);
  if (!group) return null;
  const [{ data: msgs }, { data: bot }, { data: log }, { data: clients }, { data: st }, { data: notes }] = await Promise.all([
    db.from('wa_messages').select('id, group_id, body, media_type, media_url, media_path, is_from_me, sent_at, raw').eq('group_id', groupId).order('sent_at', { ascending: false }).limit(200),
    db.from('wa_bot_chats').select('group_id, status, replies, reason, lead').eq('group_id', groupId).maybeSingle(),
    db.from('wa_bot_log').select('reply, handoff, ok, detail, created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(30),
    clientPhones(ws).then((data) => ({ data })),
    db.from('chat_state').select('group_id, assigned_to, assigned_name, resolved_at, first_message, first_message_at, source_id, source_label, source_channel, source_by, answers, deal_id').eq('group_id', groupId).maybeSingle(),
    db.from('chat_notes').select('id, group_id, author_name, body, created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100),
  ]);
  const client = (clients || []).find((c: any) => phoneTail(c.phone).length >= 8 && phoneTail(c.phone) === phoneTail(group.wa_id)) || null;
  let deals: any[] = [];
  const linkedDeal = (st as any)?.deal_id as string | null;
  const dealCols = 'id, title, stage, value, salesman_name, salesman_id, invoice_id, client_id';
  const [mine, linked] = await Promise.all([
    client ? db.from('crm_deals').select(dealCols).eq('client_id', (client as any).id).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] as any[] }),
    linkedDeal ? db.from('crm_deals').select(dealCols).eq('id', linkedDeal).maybeSingle() : Promise.resolve({ data: null as any }),
  ]);
  deals = [...((mine.data || []) as any[])];
  if (linked.data && !deals.some((d) => d.id === (linked.data as any).id)) deals.unshift(linked.data);
  const invIds = deals.map((d) => d.invoice_id).filter(Boolean);
  const { data: invRows } = invIds.length ? await db.from('invoices').select('id, invoice_number, status, total_amount, amount_paid, due_date').in('id', invIds) : { data: [] as any[] };
  const invById = new Map<string, any>(((invRows || []) as any[]).map((i) => [i.id, i]));
  const todayJkt = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const [links, labelDefs, reminders, { data: sess }, meeting] = await Promise.all([
    db.from('chat_label_links').select('label_id').eq('group_id', groupId),
    listLabels(ws),
    chatReminders(groupId),
    db.from('bot_flow_sessions').select('flow_name, kind, field, resume_at, expires_at').eq('group_id', groupId).maybeSingle(),
    upcomingFor(groupId).catch(() => null),
  ]);
  const onChat = new Set(((links.data || []) as Array<{ label_id: string }>).map((l) => l.label_id));
  const rawMsgs = (msgs || []) as Array<ChatMessageRow & { media_url?: string | null; media_path?: string | null }>;
  const signed = await signMedia(rawMsgs.map((x) => x.media_path || '').filter(Boolean));
  const mediaOf = new Map(rawMsgs.map((x) => [x.id, x.media_path ? signed.get(x.media_path) ?? null : x.media_url ?? null]));
  const botReplies = (log || []).filter((l: any) => l.reply).map((l: any) => String(l.reply));
  const state = st as (ChatStateRow & { first_message_at?: string | null; source_id?: string | null; answers?: Record<string, string> | null }) | null;
  const ses = sess as { flow_name: string; kind: 'answer' | 'wait'; field: string | null; resume_at: string | null; expires_at: string | null } | null;
  const sessionLive = !!ses && !(ses.kind === 'answer' && ses.expires_at && ses.expires_at < new Date().toISOString());
  // a chat that belongs to an ERP client gives the client its source (once)
  if (client && state?.first_message && !(client as any).lead_source && !(client as any).first_contact_message) {
    void syncClientSource((client as any).id, { source_label: state.source_label ?? null, source_channel: state.source_channel ?? null, first_message: state.first_message, first_message_at: state.first_message_at ?? null });
  }
  const lastLead = ((msgs || []) as ChatMessageRow[]).find((m) => !m.is_from_me);
  return {
    id: group.id, phone: group.wa_id, name: (group.name || '').trim() || chatLabel(group.wa_id),
    messages: threadOf((msgs || []) as ChatMessageRow[], botReplies, (notes || []) as ChatNoteRow[]).map((x) => (x.mediaType ? { ...x, mediaUrl: mediaOf.get(x.id) ?? null } : x)),
    labels: labelDefs.filter((l) => onChat.has(l.id)), reminders,
    bot: bot ? { status: (bot as any).status, replies: (bot as any).replies, reason: (bot as any).reason, lead: (bot as any).lead } : { status: 'new', replies: 0, reason: null, lead: null },
    botLog: (log || []).slice(0, 10),
    assignedTo: state?.assigned_to ? { id: state.assigned_to, name: state.assigned_name || 'Team' } : null,
    answers: Object.entries(state?.answers || {}).filter(([k, v]) => k && typeof v === 'string' && v).map(([field, value]) => ({ field, value: String(value) })),
    meeting: meeting ? { id: meeting.id, startsAt: meeting.starts_at, endsAt: meeting.ends_at, meetUrl: meeting.meet_url, bookedBy: meeting.booked_by, confirmed: !!meeting.confirmed_at, confirmAsked: !!meeting.confirm_sent_at, wantsOtherTime: !!meeting.reschedule_asked_at, owner: meeting.owner_name ?? null } : null,
    flowWaiting: sessionLive && ses ? { flow: ses.flow_name, kind: ses.kind, field: ses.field, until: ses.kind === 'wait' ? ses.resume_at : ses.expires_at } : null,
    source: sourceOf(state), sourceId: state?.source_id ?? null, firstMessage: state?.first_message ?? null,
    resolved: !!state?.resolved_at && !(lastLead && lastLead.sent_at > state.resolved_at),
    client: client ? { id: (client as any).id, name: (client as any).name, sales: (client as any).sales_name, serviceEnd: (client as any).service_end_date } : null,
    deals: (deals || []).map((d: any) => { const inv = d.invoice_id ? invById.get(d.invoice_id) : null; return { id: d.id, title: d.title, stage: d.stage, value: Number(d.value || 0), sales: d.salesman_name, salesId: d.salesman_id ?? null, payment: paymentOf(inv, todayJkt), invoice: inv ? { number: inv.invoice_number ?? null, total: Number(inv.total_amount || 0), paid: Number(inv.amount_paid || 0), due: inv.due_date ?? null } : null }; }),
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
  const group = await ownGroup(ws, groupId);
  if (!group) return fail(404, 'Chat not found.');
  const { data: gd } = await db.from('wa_groups').select('device_id').eq('id', groupId).maybeSingle();
  const devicePhone = (await salesDevices(ws)).find((d) => d.id === (gd as any)?.device_id)?.phone ?? null;

  const sent = await sendToChat(groupId, group.wa_id, clean);
  if (!sent.ok) return fail(/24 hours|not connected/.test(sent.detail) ? 409 : 502, sent.detail);

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
export const listAgents = (ws: string) => memo(`agents:${ws}`, 300_000, () => loadAgents(ws));

async function loadAgents(ws: string): Promise<Array<{ id: string; name: string; role: string }>> {
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
  const [{ data: cfg }, { data: msgs }, knowledge] = await Promise.all([
    db.from('wa_bot_config').select('persona_name, company_name').eq('workspace_id', ws).maybeSingle(),
    db.from('wa_messages').select('body, media_type, is_from_me, sent_at').eq('group_id', groupId).order('sent_at', { ascending: false }).limit(14),
    loadKnowledge(ws),
  ]);
  const history = (msgs || []).reverse().map((m: any) => ({ from: (m.is_from_me ? 'team' : 'lead') as 'team' | 'lead', text: m.body || `(${m.media_type || 'pesan'})` }));
  if (!history.length) return fail(400, 'There is nothing to answer yet.');
  const { system, prompt } = buildSuggestPrompt({ persona: cfg?.persona_name || 'Fefe', company: cfg?.company_name || 'Prof Toko Online', knowledge, agentName: by.name, history });
  try {
    const out = await askBotModel(system, prompt);
    const text = cleanSuggestion(out.text, knowledge);
    return text ? { ok: true, text, model: out.model } : fail(502, 'The AI did not write anything. Try again.');
  } catch (e: any) {
    return fail(502, `The AI could not answer: ${String(e?.message || e).slice(0, 160)}`);
  }
}
