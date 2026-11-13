import { createAdminClient } from '@/lib/api/supabase-admin';
import { chatLabel, clientPhoneOf, isMetaChat, phoneTail } from './channel';
import { sendMedia, asDelivery } from '@/lib/wa/send-media';
import { adminMediaStorage } from '@/lib/wa/media-storage';
import { normalizeJpeg } from '@/lib/wa/report-image';
import { forget, memo } from './cache';
import { checkDueAt, checkImage, checkStage, cleanLabel, cleanLabelIds, cleanLeadInput, jakartaDay, mayMoveDeal, mediaExt, MAX_SEND_BYTES, reminderState, type LeadInput } from './crm-link';
import type { ChatLabel, NextReminder } from './shape';

/**
 * Chat batch 2 (server side): labels, a chat becoming an ERP lead (a prospect client plus a deal, exactly like the ERP's own "New lead"), moving a
 * deal's stage, follow-up reminders (also an ERP task, so they show in the planner), and images: incoming ones kept in our storage, outgoing ones
 * uploaded by the browser and sent from the sales number. The rules are in crm-link.ts (tested).
 */

type Who = { userId: string; name: string; role?: string };
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });
const BUCKET = 'wa-files';

/** One chat of the company's sales number, or null. */
async function chatOf(ws: string, groupId: string): Promise<{ id: string; wa_id: string; name: string | null } | null> {
  const db = createAdminClient();
  const { data: g } = await db.from('wa_groups').select('id, wa_id, name, device_id, is_group').eq('id', groupId).eq('workspace_id', ws).maybeSingle();
  if (!g || (g as any).is_group) return null;
  const { data: d } = await db.from('wa_devices').select('role').eq('id', (g as any).device_id).maybeSingle();
  return (d as any)?.role === 'sales' ? { id: (g as any).id, wa_id: (g as any).wa_id, name: (g as any).name } : null;
}

// ---------------------------------------------------------------- labels
export const listLabels = (ws: string) => memo(`labels:${ws}`, 30_000, async () => {
  const { data } = await createAdminClient().from('chat_labels').select('id, name, color').eq('workspace_id', ws).order('name');
  return (data || []) as ChatLabel[];
});

export async function saveLabel(ws: string, input: { id?: string; name?: unknown; color?: unknown }, by: Who): Promise<{ ok: true } | Fail> {
  const c = cleanLabel(input);
  if (!c.ok) return fail(400, c.error);
  const db = createAdminClient();
  const res = input.id
    ? await db.from('chat_labels').update(c.value).eq('id', input.id).eq('workspace_id', ws)
    : await db.from('chat_labels').insert({ workspace_id: ws, ...c.value, created_by: by.name });
  forget(`labels:${ws}`);
  if (res.error) return fail(res.error.code === '23505' ? 409 : 500, res.error.code === '23505' ? `A label called "${c.value.name}" already exists.` : res.error.message);
  return { ok: true };
}

export async function deleteLabel(ws: string, id: string): Promise<{ ok: true } | Fail> {
  const { error } = await createAdminClient().from('chat_labels').delete().eq('id', id).eq('workspace_id', ws);
  forget(`labels:${ws}`);
  return error ? fail(500, error.message) : { ok: true };
}

/** Sets exactly these labels on a chat. */
export async function setChatLabels(ws: string, groupId: string, ids: unknown): Promise<{ ok: true; labels: ChatLabel[] } | Fail> {
  if (!(await chatOf(ws, groupId))) return fail(404, 'Chat not found.');
  const all = await listLabels(ws);
  const keep = cleanLabelIds(ids, all.map((l) => l.id));
  const db = createAdminClient();
  await db.from('chat_label_links').delete().eq('group_id', groupId);
  if (keep.length) {
    const { error } = await db.from('chat_label_links').insert(keep.map((label_id) => ({ group_id: groupId, label_id, workspace_id: ws })));
    if (error) return fail(500, error.message);
  }
  return { ok: true, labels: all.filter((l) => keep.includes(l.id)) };
}

/** Labels and next open reminder per chat, for the inbox list. */
export async function inboxExtras(ws: string, groupIds: string[], now = new Date()): Promise<{ labels: Map<string, ChatLabel[]>; reminders: Map<string, NextReminder> }> {
  const db = createAdminClient();
  const labels = new Map<string, ChatLabel[]>();
  const reminders = new Map<string, NextReminder>();
  if (!groupIds.length) return { labels, reminders };
  const [defs, { data: links }, { data: rem }] = await Promise.all([
    listLabels(ws),
    db.from('chat_label_links').select('group_id, label_id').eq('workspace_id', ws).in('group_id', groupIds),
    db.from('chat_reminders').select('id, group_id, due_at, note').eq('workspace_id', ws).is('done_at', null).in('group_id', groupIds).order('due_at', { ascending: true }).limit(1000),
  ]);
  const byId = new Map(defs.map((l) => [l.id, l]));
  for (const l of (links || []) as Array<{ group_id: string; label_id: string }>) { const d = byId.get(l.label_id); if (d) labels.set(l.group_id, [...(labels.get(l.group_id) || []), d]); }
  for (const r of (rem || []) as Array<{ id: string; group_id: string; due_at: string; note: string | null }>) {
    if (!reminders.has(r.group_id)) reminders.set(r.group_id, { id: r.id, dueAt: r.due_at, note: r.note, state: reminderState(r.due_at, now) });
  }
  return { labels, reminders };
}

// ---------------------------------------------------------------- the chat becomes an ERP lead
const tail9 = phoneTail;

/**
 * Creates the lead in the ERP from this chat: when the number is not a client yet, a prospect client (with the chat's phone and lead source) is made,
 * then a deal in the stage "Lead" owned by the chosen salesperson (or the person who pressed the button). Like the ERP's own "New lead".
 */
export async function createLeadFromChat(ws: string, groupId: string, input: LeadInput, by: Who): Promise<{ ok: true; dealId: string; clientId: string; newClient: boolean } | Fail> {
  const chat = await chatOf(ws, groupId);
  if (!chat) return fail(404, 'Chat not found.');
  const c = cleanLeadInput(input, chat.name || chatLabel(chat.wa_id));
  if (!c.ok) return fail(400, c.error);
  const db = createAdminClient();

  // who owns the deal: a salesperson always owns their own; owners and admins may pick someone
  let salesmanId = by.userId;
  if (c.value.salesmanId && by.role !== 'sales') salesmanId = c.value.salesmanId;
  const { data: prof } = await db.from('profiles').select('full_name, email').eq('id', salesmanId).maybeSingle();
  const salesmanName = (prof as any)?.full_name || String((prof as any)?.email || '').split('@')[0] || by.name;

  // the client: the one with this number, or a new prospect
  const { data: clients } = await db.from('clients').select('id, name, phone').eq('workspace_id', ws).not('phone', 'is', null).limit(3000);
  const t = tail9(chat.wa_id);
  let client = ((clients || []) as Array<{ id: string; name: string; phone: string }>).find((x) => t.length >= 8 && tail9(x.phone) === t) || null;
  let newClient = false;
  if (!client) {
    const { data: st } = await db.from('chat_state').select('source_label, source_channel, first_message, first_message_at').eq('group_id', groupId).maybeSingle();
    const s = st as any;
    const { data: made, error } = await db.from('clients').insert({
      workspace_id: ws, name: c.value.name, phone: clientPhoneOf(chat.wa_id), store_name: c.value.store, contact_type: 'client', is_prospect: true, created_by: by.userId,
      sales_name: salesmanName,
      lead_source: s?.source_label ?? null, lead_channel: s?.source_channel && s.source_channel !== 'unknown' ? s.source_channel : null,
      first_contact_message: s?.first_message ?? null, first_contact_at: s?.first_message_at ?? null,
    }).select('id, name, phone').single();
    if (error || !made) return fail(500, `Could not create the client: ${error?.message}`);
    client = made as any; newClient = true;
    forget(`clients:${ws}`);
  }

  const now = new Date().toISOString();
  const { data: deal, error: dErr } = await db.from('crm_deals').insert({
    workspace_id: ws, client_id: client!.id, lead_name: client!.name, title: c.value.title, value: c.value.value, stage: 'Lead',
    salesman_id: salesmanId, salesman_name: salesmanName, notes: c.value.notes, pipeline_month: now.slice(0, 7), stage_changed_at: now,
  }).select('id').single();
  if (dErr || !deal) {
    if (newClient) await db.from('clients').delete().eq('id', client!.id);   // never leave an orphan prospect behind
    return fail(500, `Could not create the deal: ${dErr?.message}`);
  }
  return { ok: true, dealId: (deal as any).id, clientId: client!.id, newClient };
}

/** Moves a deal between Lead, Contacted, Negotiation and Cold Case (the ERP's own rule). */
export async function moveDealStage(ws: string, dealId: string, stageIn: unknown, by: Who): Promise<{ ok: true } | Fail> {
  const st = checkStage(stageIn);
  if (!st.ok) return fail(400, st.error);
  const db = createAdminClient();
  const { data: deal } = await db.from('crm_deals').select('id, stage, salesman_id').eq('id', dealId).eq('workspace_id', ws).maybeSingle();
  if (!deal) return fail(404, 'Deal not found.');
  const may = mayMoveDeal(by.role || '', by.userId, deal as any);
  if (!may.ok) return fail(403, may.error);
  const now = new Date().toISOString();
  const { error } = await db.from('crm_deals').update({ stage: st.stage, stage_changed_at: now, updated_at: now }).eq('id', dealId);
  return error ? fail(500, error.message) : { ok: true };
}

// ---------------------------------------------------------------- reminders
/** A follow-up reminder on a chat, for the person it is given to (default: who set it). It is also put in the ERP planner as a task. */
export async function addReminder(ws: string, groupId: string, input: { dueAt?: unknown; note?: unknown; assignTo?: unknown }, by: Who): Promise<{ ok: true; id: string } | Fail> {
  const chat = await chatOf(ws, groupId);
  if (!chat) return fail(404, 'Chat not found.');
  const due = checkDueAt(input.dueAt);
  if (!due.ok) return fail(400, due.error);
  const note = String(input.note ?? '').trim().slice(0, 300) || null;
  const db = createAdminClient();
  let assignTo = by.userId; let assignName = by.name;
  const want = String(input.assignTo ?? '');
  if (want && want !== by.userId) {
    const { data: m } = await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('user_id', want).maybeSingle();
    if (!m) return fail(400, 'That person is not in the team.');
    const { data: p } = await db.from('profiles').select('full_name, email').eq('id', want).maybeSingle();
    assignTo = want; assignName = (p as any)?.full_name || String((p as any)?.email || '').split('@')[0] || 'Team';
  }
  const who = chat.name || chatLabel(chat.wa_id);
  const { data: task } = await db.from('staff_tasks').insert({
    workspace_id: ws, title: `Follow up WhatsApp: ${who}`.slice(0, 200), note: [note, `Set in the chat inbox by ${by.name}.`].filter(Boolean).join('\n'),
    assigned_to: assignTo, assigned_by: by.userId, due_date: jakartaDay(due.iso), priority: 'medium', status: 'open',
  }).select('id').single();
  const { data: row, error } = await db.from('chat_reminders').insert({
    workspace_id: ws, group_id: groupId, due_at: due.iso, note, assigned_to: assignTo, assigned_name: assignName, created_by_name: by.name, staff_task_id: (task as any)?.id ?? null,
  }).select('id').single();
  if (error || !row) return fail(500, error?.message || 'Could not save the reminder.');
  return { ok: true, id: (row as any).id };
}

/** Done (or not done again); the ERP task follows. */
export async function setReminderDone(ws: string, id: string, done: boolean, by: Who): Promise<{ ok: true } | Fail> {
  const db = createAdminClient();
  const { data: r } = await db.from('chat_reminders').select('id, staff_task_id').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!r) return fail(404, 'Reminder not found.');
  const at = done ? new Date().toISOString() : null;
  const { error } = await db.from('chat_reminders').update({ done_at: at, done_by: done ? by.name : null }).eq('id', id);
  if (error) return fail(500, error.message);
  if ((r as any).staff_task_id) await db.from('staff_tasks').update({ status: done ? 'done' : 'open', done_at: at }).eq('id', (r as any).staff_task_id);
  return { ok: true };
}

/** Open reminders: mine (default) or everyone's, soonest first, with the chat name. */
export async function listReminders(ws: string, me: Who, scope: 'mine' | 'all') {
  let q = createAdminClient().from('chat_reminders').select('id, group_id, due_at, note, assigned_to, assigned_name, created_by_name, wa_groups(name, wa_id)').eq('workspace_id', ws).is('done_at', null).order('due_at', { ascending: true }).limit(200);
  if (scope === 'mine') q = q.eq('assigned_to', me.userId);
  const { data } = await q;
  const now = new Date();
  return ((data || []) as any[]).map((r) => {
    const g = Array.isArray(r.wa_groups) ? r.wa_groups[0] : r.wa_groups;
    return { id: r.id, groupId: r.group_id, chat: String(g?.name || (g?.wa_id ? chatLabel(g.wa_id) : 'Chat')), dueAt: r.due_at, note: r.note, assignedName: r.assigned_name, createdBy: r.created_by_name, state: reminderState(r.due_at, now) };
  });
}

/** The reminders of one chat (open first, then the last few done). */
export async function chatReminders(groupId: string) {
  const { data } = await createAdminClient().from('chat_reminders').select('id, due_at, note, assigned_name, created_by_name, done_at, done_by').eq('group_id', groupId).order('due_at', { ascending: true }).limit(30);
  const now = new Date();
  const rows = ((data || []) as any[]).map((r) => ({ id: r.id, dueAt: r.due_at, note: r.note, assignedName: r.assigned_name, createdBy: r.created_by_name, doneAt: r.done_at, doneBy: r.done_by, state: reminderState(r.due_at, now) }));
  return [...rows.filter((r) => !r.doneAt), ...rows.filter((r) => r.doneAt).slice(-5)];
}

// ---------------------------------------------------------------- images
/** Sending photos needs a Fonnte package with attachments on the sales number; an admin switches it on (AI Kamus > Bot script & settings). Kept 30 s. */
export const mediaEnabled = (ws: string) => memo(`media:${ws}`, 30_000, async () => {
  const { data } = await createAdminClient().from('wa_bot_config').select('media_enabled').eq('workspace_id', ws).maybeSingle();
  return (data as any)?.media_enabled === true;
});
const MEDIA_OFF = "Sending photos is locked: the sales number's Fonnte package does not include attachments yet. An admin can switch it on in AI Kamus > Bot script & settings after upgrading.";

/**
 * Keeps an incoming file in our storage (Fonnte's link may not last), and records where on the message. At most 10 MB. Never throws: the message is
 * already saved with Fonnte's link, so a failure here only means the dashboard shows that link instead.
 */
export async function archiveInboundMedia(ws: string, groupId: string, messageId: string, url: string, mediaType: string | null): Promise<void> {
  try {
    if (!/^https:\/\//i.test(url)) return;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) return;
    const path = `chat/${ws}/${groupId}/in-${messageId}.${mediaExt(mediaType, url)}`;
    const db = createAdminClient();
    const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: res.headers.get('content-type') || 'application/octet-stream', upsert: true });
    if (up.error) return;
    await db.from('wa_messages').update({ media_path: path }).eq('id', messageId);
  } catch { /* keep Fonnte's link */ }
}

/** Short-lived links for the files of a thread, in one call. */
export async function signMedia(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = Array.from(new Set(paths.filter(Boolean)));
  if (!list.length) return out;
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrls(list, 3600);
  for (const d of (data || []) as Array<{ path: string | null; signedUrl: string }>) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/** A one-time link the browser uses to upload a picture for this chat straight to storage. */
export async function createImageUploadUrl(ws: string, groupId: string, fileName: string, size: number, type: string): Promise<{ ok: true; path: string; token: string; bucket: string } | Fail> {
  if (!(await chatOf(ws, groupId))) return fail(404, 'Chat not found.');
  if (!(await mediaEnabled(ws))) return fail(403, MEDIA_OFF);
  const c = checkImage(fileName, size, type);
  if (!c.ok) return fail(400, c.error);
  const path = `chat/${ws}/${groupId}/out-${crypto.randomUUID()}.${c.ext}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail(500, `Could not prepare the upload: ${error?.message || 'unknown error'}`);
  return { ok: true, path, token: data.token, bucket: BUCKET };
}

/** Sends the uploaded picture (made lighter first) with an optional caption from the sales number, and keeps it in the chat. */
export async function sendChatImage(ws: string, groupId: string, input: { path?: unknown; caption?: unknown }, by: Who): Promise<{ ok: true } | Fail> {
  const chat = await chatOf(ws, groupId);
  if (!chat) return fail(404, 'Chat not found.');
  if (!(await mediaEnabled(ws))) return fail(403, MEDIA_OFF);
  if (isMetaChat(chat.wa_id)) return fail(400, 'Sending pictures to Instagram and Messenger is not ready yet. Send text, or share a link.');
  const path = String(input.path ?? '');
  if (!path.startsWith(`chat/${ws}/${groupId}/out-`) || path.includes('..')) return fail(400, 'That picture does not belong to this chat.');
  if (!process.env.FONNTE_TOKEN_SALES) return fail(503, 'The sales number is not connected (FONNTE_TOKEN_SALES is missing on the server).');
  const caption = String(input.caption ?? '').trim().slice(0, 1000);
  const db = createAdminClient();
  const { data: file, error: dErr } = await db.storage.from(BUCKET).download(path);
  if (dErr || !file) return fail(400, 'The picture was not found. Please upload it again.');
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  try { bytes = await normalizeJpeg(bytes); } catch { /* send as it is */ }
  if (bytes.byteLength > MAX_SEND_BYTES) return fail(400, 'The picture is still over 4 MB after shrinking. Please send a smaller one.');
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const sendPath = isJpg ? path.replace(/\.(png|webp)$/i, '.jpg') : path;
  const { data: settings } = await db.from('wa_settings').select('image_delivery').eq('workspace_id', ws).maybeSingle();
  const sent = await sendMedia({
    phones: [chat.wa_id], caption, data: bytes, filename: sendPath.split('/').pop() || 'photo.jpg', contentType: isJpg ? 'image/jpeg' : 'image/png',
    path: sendPath, delivery: asDelivery((settings as any)?.image_delivery), storage: adminMediaStorage(), token: process.env.FONNTE_TOKEN_SALES,
  });
  if (!sent.ok) return fail(502, sent.detail);
  const at = new Date().toISOString();
  const { data: dev } = await db.from('wa_devices').select('phone').eq('workspace_id', ws).eq('role', 'sales').eq('active', true).limit(1).maybeSingle();
  await db.from('wa_messages').insert({
    workspace_id: ws, group_id: groupId, sender_phone: (dev as any)?.phone ?? null, sender_name: by.name, body: caption || null, media_type: 'image', media_path: sendPath,
    is_from_me: true, dedupe_key: `dashboard:${crypto.randomUUID()}`, sent_at: at, source: 'dashboard', raw: { sentBy: { id: by.userId, name: by.name } },
  });
  await db.from('wa_groups').update({ last_message_at: at }).eq('id', groupId);
  await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'human', reason: `${by.name} replied from the dashboard.`, updated_at: at }, { onConflict: 'group_id' });
  return { ok: true };
}
