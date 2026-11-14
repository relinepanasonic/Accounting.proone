import { createAdminClient } from '@/lib/api/supabase-admin';
import { accessToken, authUrl, busyTimes, createMeetEvent, deleteEvent, exchangeCode, googleConfigured, makeState, patchEventTime } from '@/lib/google/calendar';
import { memo, forget } from './cache';
import { bookedText, cancelledText, confirmedText, confirmText, freeSlots, matchSlot, MEET_DEFAULTS, movedText, noTimeText, offerSlots, parseDays, readMeetingReply, remindText, rescheduleText, shouldAskConfirm, slotCode, slotLabel, validTime, type Busy, type MeetSettings } from './meet-rules';
import { sendToChat } from './send-any';
import { chatLabel } from './channel';

/**
 * Free consultations with the expert team (server side). The bot offers free times and books one when the lead picks it; the team can book from
 * the inbox too. A booking goes on the shared Google Calendar with a Meet link, the lead gets the link at once and a reminder an hour before.
 * Without Google connected, bookings still work (no link: the team sends one). Rules in meet-rules.ts (tested).
 */
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

export interface Meeting {
  id: string; group_id: string | null; lead_name: string | null; store: string | null; starts_at: string; ends_at: string;
  status: 'booked' | 'done' | 'no_show' | 'cancelled'; meet_url: string | null; booked_by: string; note: string | null; created_at: string; chat?: string;
  google_event_id?: string | null; confirm_sent_at?: string | null; confirmed_at?: string | null; reschedule_offer?: string[] | null; reschedule_asked_at?: string | null;
  owner_id?: string | null; owner_name?: string | null; lead_visit_id?: string | null;
}

// ---------------------------------------------------------------- settings
export async function meetSettings(ws: string): Promise<MeetSettings> {
  const { data } = await createAdminClient().from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle();
  const r: any = data || {};
  return {
    enabled: r.meet_enabled === true, days: r.meet_days != null ? parseDays(r.meet_days) : MEET_DEFAULTS.days,
    from: validTime(r.meet_from) ? r.meet_from : MEET_DEFAULTS.from, to: validTime(r.meet_to) ? r.meet_to : MEET_DEFAULTS.to,
    minutes: Number(r.meet_minutes) || MEET_DEFAULTS.minutes, noticeHours: r.meet_notice_hours != null ? Number(r.meet_notice_hours) : MEET_DEFAULTS.noticeHours,
    daysAhead: Number(r.meet_days_ahead) || MEET_DEFAULTS.daysAhead,
    ownerId: r.meet_owner_id ?? null, ownerName: r.meet_owner_name ?? null,
  };
}

export async function saveMeetSettings(ws: string, p: Partial<MeetSettings>): Promise<{ ok: true } | Fail> {
  const row: Record<string, unknown> = { workspace_id: ws, updated_at: new Date().toISOString() };
  if (typeof p.enabled === 'boolean') row.meet_enabled = p.enabled;
  if (p.days !== undefined) { const d = parseDays((p.days as unknown as number[]).join(',')); if (!d.length) return fail(400, 'Pick at least one day.'); row.meet_days = d.join(','); }
  if (p.from !== undefined) { if (!validTime(p.from)) return fail(400, 'The start time must look like 10:00.'); row.meet_from = p.from; }
  if (p.to !== undefined) { if (!validTime(p.to)) return fail(400, 'The end time must look like 17:00.'); row.meet_to = p.to; }
  if (p.minutes !== undefined) { const n = Math.round(Number(p.minutes)); if (!(n >= 15 && n <= 120)) return fail(400, 'A meeting lasts 15 to 120 minutes.'); row.meet_minutes = n; }
  if (p.noticeHours !== undefined) { const n = Math.round(Number(p.noticeHours)); if (!(n >= 0 && n <= 72)) return fail(400, 'The notice is 0 to 72 hours.'); row.meet_notice_hours = n; }
  if (p.daysAhead !== undefined) { const n = Math.round(Number(p.daysAhead)); if (!(n >= 1 && n <= 30)) return fail(400, 'Offer 1 to 30 days ahead.'); row.meet_days_ahead = n; }
  if (p.ownerId !== undefined) {
    if (p.ownerId !== null && !isUuid(p.ownerId)) return fail(400, 'Pick a salesperson from the list.');
    row.meet_owner_id = p.ownerId; row.meet_owner_name = p.ownerId ? String(p.ownerName || '').trim().slice(0, 80) || null : null;
  }
  if (row.meet_from && row.meet_to && String(row.meet_from) >= String(row.meet_to)) return fail(400, 'The end time must be after the start time.');
  const { error } = await createAdminClient().from('wa_bot_config').upsert(row, { onConflict: 'workspace_id' });
  if (error) return fail(500, /column/.test(error.message) ? 'The meeting tables are not in the database yet: run the meetings SQL first.' : error.message);
  forget(`slots:${ws}`);
  return { ok: true };
}

// ---------------------------------------------------------------- Google
async function googleLink(ws: string): Promise<{ email: string | null; refresh_token: string; calendar_id: string } | null> {
  const { data } = await createAdminClient().from('google_calendar_link').select('email, refresh_token, calendar_id').eq('workspace_id', ws).maybeSingle();
  return (data as any) ?? null;
}

export async function googleStatus(ws: string) {
  const link = await googleLink(ws).catch(() => null);
  return { configured: googleConfigured(), connected: !!link, email: link?.email ?? null };
}

export function googleConnectUrl(ws: string, by: string): { ok: true; url: string } | Fail {
  if (!googleConfigured()) return fail(400, 'Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server first (Vercel, ERP project), then redeploy.');
  return { ok: true, url: authUrl(makeState(ws, by)) };
}

export async function finishGoogleConnect(ws: string, by: string, code: string): Promise<{ ok: true; email: string | null } | Fail> {
  const r = await exchangeCode(code);
  if (!r.ok) return fail(400, r.error);
  const { error } = await createAdminClient().from('google_calendar_link').upsert({ workspace_id: ws, email: r.email, refresh_token: r.refreshToken, calendar_id: 'primary', connected_by: by, connected_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) return fail(500, error.message);
  forget(`slots:${ws}`);
  return { ok: true, email: r.email };
}

export async function disconnectGoogle(ws: string): Promise<{ ok: true } | Fail> {
  const { error } = await createAdminClient().from('google_calendar_link').delete().eq('workspace_id', ws);
  forget(`slots:${ws}`);
  return error ? fail(500, error.message) : { ok: true };
}

// ---------------------------------------------------------------- free times
async function busyFor(ws: string, s: MeetSettings, now: Date): Promise<Busy[]> {
  const to = new Date(now.getTime() + (s.daysAhead + 1) * 86400000);
  const db = createAdminClient();
  const { data: booked } = await db.from('chat_meetings').select('starts_at, ends_at').eq('workspace_id', ws).eq('status', 'booked').gte('ends_at', now.toISOString()).lte('starts_at', to.toISOString());
  const busy: Busy[] = ((booked || []) as any[]).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) }));
  const link = await googleLink(ws).catch(() => null);
  if (link) {
    try { busy.push(...(await busyTimes(await accessToken(link.refresh_token), link.calendar_id, now, to))); } catch (e) { console.error('google busy failed', e); }
  }
  return busy;
}

/** Free start times right now. `fresh` skips the 60-second memory (used when booking). */
export async function availableSlots(ws: string, fresh = false): Promise<Date[]> {
  // The switch in Jadwal is only about the BOT inviting leads (see meetingContext); the free times exist, and the team can book from the inbox, whether it is on or off.
  const run = async () => { const s = await meetSettings(ws); const now = new Date(); return freeSlots(s, now, await busyFor(ws, s, now)); };
  if (fresh) return run();
  return (await memo(`slots:${ws}`, 60_000, async () => (await run()).map((d) => d.toISOString()))).map((x: string) => new Date(x));
}

/** For the bot: the short list to offer (with the code it must send back), and the lead's own upcoming meeting if there is one. */
export async function meetingContext(ws: string, groupId: string): Promise<{ enabled: boolean; minutes: number; offer: Array<{ code: string; label: string }>; booked: { id: string; label: string; meetUrl: string | null } | null }> {
  const s = await meetSettings(ws).catch(() => ({ ...MEET_DEFAULTS }));
  if (!s.enabled) return { enabled: false, minutes: s.minutes, offer: [], booked: null };
  const mine = await upcomingFor(groupId).catch(() => null);
  // free times to offer: to book, or (when already booked) to move the meeting to
  const free = (await availableSlots(ws).catch(() => [])).filter((d) => !mine || d.getTime() !== new Date(mine.starts_at).getTime());
  const offer = offerSlots(free).map((d) => ({ code: slotCode(d), label: slotLabel(d) }));
  return { enabled: true, minutes: s.minutes, offer, booked: mine ? { id: mine.id, label: slotLabel(new Date(mine.starts_at)), meetUrl: mine.meet_url } : null };
}

export async function upcomingFor(groupId: string): Promise<Meeting | null> {
  const { data } = await createAdminClient().from('chat_meetings').select('*').eq('group_id', groupId).eq('status', 'booked').gte('ends_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(1).maybeSingle();
  return (data as Meeting | null) ?? null;
}

// ---------------------------------------------------------------- booking
/**
 * Books a free time for a chat: checks it is still free, saves it (the database refuses two bookings at the same time), puts it on Google Calendar
 * with a Meet link, and adds a note in the chat for the team. Returns the text for the lead (time and link).
 */
export async function bookMeeting(ws: string, input: { groupId: string | null; start: unknown; leadName?: string | null; store?: string | null; by: string; byUser?: { id: string; name: string } | null }): Promise<{ ok: true; meeting: Meeting; text: string } | Fail> {
  const s = await meetSettings(ws);
  const slot = matchSlot(input.start, await availableSlots(ws, true));
  if (!slot) return fail(409, 'That time is not free any more. Pick another one.');
  const db = createAdminClient();
  let chatName = '';
  if (input.groupId) {
    const { data: g } = await db.from('wa_groups').select('name, wa_id').eq('id', input.groupId).eq('workspace_id', ws).maybeSingle();
    if (!g) return fail(404, 'Chat not found.');
    chatName = String((g as any).name || chatLabel((g as any).wa_id));
    if (await upcomingFor(input.groupId)) return fail(409, 'This chat already has a meeting booked. Cancel it first to book another time.');
  }
  const end = new Date(slot.getTime() + s.minutes * 60000);
  const leadName = String(input.leadName || chatName || '').trim().slice(0, 80) || null;
  const { data: row, error } = await db.from('chat_meetings').insert({
    workspace_id: ws, group_id: input.groupId, lead_name: leadName, store: String(input.store || '').trim().slice(0, 120) || null,
    starts_at: slot.toISOString(), ends_at: end.toISOString(), status: 'booked', booked_by: input.by.slice(0, 80),
  }).select('*').single();
  if (error || !row) return fail(/duplicate|unique/i.test(error?.message || '') ? 409 : 500, /duplicate|unique/i.test(error?.message || '') ? 'Someone just took that time. Pick another one.' : error?.message || 'Could not book.');
  let meeting = row as Meeting;
  forget(`slots:${ws}`);

  // on the shared calendar, with a Meet link (a Google problem never undoes the booking: the team gets a note to send a link)
  const link = await googleLink(ws).catch(() => null);
  let note: string | null = null;
  if (link) {
    try {
      const ev = await createMeetEvent(await accessToken(link.refresh_token), link.calendar_id, {
        title: `Konsultasi gratis: ${leadName || 'calon klien'}${meeting.store ? ` (${meeting.store})` : ''}`,
        description: [`Dibooking oleh: ${input.by}`, leadName ? `Nama: ${leadName}` : '', meeting.store ? `Toko: ${meeting.store}` : '', 'Dari chat dashboard Prof Toko Online.'].filter(Boolean).join('\n'),
        start: slot, end, requestId: meeting.id,
      });
      const { data: upd } = await db.from('chat_meetings').update({ meet_url: ev.meetUrl, google_event_id: ev.id }).eq('id', meeting.id).select('*').single();
      if (upd) meeting = upd as Meeting;
    } catch (e: any) {
      note = `Google Calendar: ${String(e?.message || e).slice(0, 160)}`;
      await db.from('chat_meetings').update({ note }).eq('id', meeting.id);
    }
  } else note = 'Google Calendar is not connected: send the lead a meeting link yourself.';

  // in the ERP: a meeting in Meetings (and the Today calendar) for the salesperson who takes it
  const owner = await ownerFor(ws, input.groupId, s, input.byUser ?? null);
  if (owner) {
    const visitId = await saveVisit(ws, meeting, owner, null).catch((e) => { console.error('lead visit failed', e); return null; });
    const { data: upd } = await db.from('chat_meetings').update({ owner_id: owner.id, owner_name: owner.name, lead_visit_id: visitId }).eq('id', meeting.id).select('*').single();
    if (upd) meeting = upd as Meeting;
    if (input.groupId && owner.fromSettings) await db.from('chat_state').upsert({ group_id: input.groupId, workspace_id: ws, assigned_to: owner.id, assigned_name: owner.name, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
  } else note = [note, 'No salesperson takes it in the ERP yet: pick one in Jadwal.'].filter(Boolean).join(' ');

  if (input.groupId) {
    await db.from('chat_notes').insert({ workspace_id: ws, group_id: input.groupId, author_id: null, author_name: input.by === 'bot' ? 'Bot' : input.by,
      body: `Konsultasi gratis dibooking: ${slotLabel(slot)}${meeting.meet_url ? `. Meet: ${meeting.meet_url}` : ''}${note ? `. ${note}` : ''}` });
  }
  return { ok: true, meeting, text: bookedText(slot, s.minutes, meeting.meet_url) };
}

/** The team books from the inbox: books, then sends the lead the time and link. */
export async function bookFromInbox(ws: string, groupId: string, start: unknown, by: { name: string; userId?: string }): Promise<{ ok: true; meeting: Meeting; sent: boolean; detail: string } | Fail> {
  const db = createAdminClient();
  const { data: g } = await db.from('wa_groups').select('wa_id').eq('id', groupId).eq('workspace_id', ws).maybeSingle();
  if (!g) return fail(404, 'Chat not found.');
  const { data: bot } = await db.from('wa_bot_chats').select('lead').eq('group_id', groupId).maybeSingle();
  const lead = ((bot as any)?.lead || {}) as { name?: string; store?: string };
  const r = await bookMeeting(ws, { groupId, start, leadName: lead.name, store: lead.store, by: by.name, byUser: by.userId ? { id: by.userId, name: by.name } : null });
  if (!r.ok) return r;
  const sent = await sendToChat(groupId, String((g as any).wa_id), `Siap kak, ${r.text.charAt(0).toLowerCase()}${r.text.slice(1)}`);
  if (sent.ok) {
    await db.from('wa_messages').insert({ workspace_id: ws, group_id: groupId, body: `Siap kak, ${r.text.charAt(0).toLowerCase()}${r.text.slice(1)}`, is_from_me: true, dedupe_key: `meeting:${r.meeting.id}`, sent_at: new Date().toISOString(), source: 'dashboard', raw: { sentBy: { name: by.name } } });
  }
  return { ok: true, meeting: r.meeting, sent: sent.ok, detail: sent.detail };
}

export async function listMeetings(ws: string, days = 30) {
  const from = new Date(Date.now() - 2 * 86400000).toISOString();
  const to = new Date(Date.now() + days * 86400000).toISOString();
  const { data } = await createAdminClient().from('chat_meetings').select('*, wa_groups(name, wa_id)').eq('workspace_id', ws).gte('starts_at', from).lte('starts_at', to).order('starts_at', { ascending: true }).limit(300);
  return ((data || []) as any[]).map((m) => {
    const g = Array.isArray(m.wa_groups) ? m.wa_groups[0] : m.wa_groups;
    const { wa_groups, ...rest } = m; void wa_groups;
    return { ...rest, chat: String(g?.name || (g?.wa_id ? chatLabel(g.wa_id) : rest.lead_name || 'Booked by hand')) } as Meeting;
  });
}

export async function setMeetingStatus(ws: string, id: string, status: unknown): Promise<{ ok: true } | Fail> {
  if (!['booked', 'done', 'no_show', 'cancelled'].includes(String(status))) return fail(400, 'Unknown status.');
  const db = createAdminClient();
  const { data: m } = await db.from('chat_meetings').select('id, google_event_id, status, lead_visit_id').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!m) return fail(404, 'Meeting not found.');
  const { error } = await db.from('chat_meetings').update({ status }).eq('id', id);
  if (error) return fail(/duplicate|unique/i.test(error.message) ? 409 : 500, /duplicate|unique/i.test(error.message) ? 'That time is taken by another booking now.' : error.message);
  if (status === 'cancelled' && (m as any).google_event_id) {
    const link = await googleLink(ws).catch(() => null);
    if (link) { try { await deleteEvent(await accessToken(link.refresh_token), link.calendar_id, (m as any).google_event_id); } catch { /* the booking is cancelled anyway */ } }
  }
  if (status === 'cancelled' && (m as any).lead_visit_id) await db.from('lead_visits').delete().eq('id', (m as any).lead_visit_id).then(() => undefined, () => undefined);
  forget(`slots:${ws}`);
  return { ok: true };
}

// ---------------------------------------------------------------- the salesperson, and the meeting in the ERP
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

/** Who takes the meeting: the person the chat is assigned to; else the default salesperson set in Jadwal; else the person who booked it. */
async function ownerFor(ws: string, groupId: string | null, s: MeetSettings, byUser: { id: string; name: string } | null): Promise<{ id: string; name: string; fromSettings: boolean } | null> {
  if (groupId) {
    const { data: st } = await createAdminClient().from('chat_state').select('assigned_to, assigned_name').eq('group_id', groupId).maybeSingle();
    if (isUuid((st as any)?.assigned_to)) return { id: (st as any).assigned_to, name: String((st as any).assigned_name || 'Sales'), fromSettings: false };
  }
  if (isUuid(s.ownerId)) return { id: s.ownerId, name: String(s.ownerName || 'Sales'), fromSettings: true };
  if (byUser && isUuid(byUser.id)) return { id: byUser.id, name: byUser.name, fromSettings: false };
  return null;
}

/** The meeting in the ERP's Meetings (lead_visits), so the salesperson sees it in Meetings and on the Today calendar. Updates it when it moves. */
async function saveVisit(ws: string, m: Meeting, owner: { id: string; name: string }, visitId: string | null): Promise<string | null> {
  const db = createAdminClient();
  const row = {
    client_name: String(m.lead_name || m.chat || 'Lead').slice(0, 120), salesman_id: owner.id, salesman_name: owner.name,
    agenda: [`Konsultasi gratis (Google Meet, dari chat)`, m.store ? `Toko: ${m.store}` : '', m.meet_url ? `Link: ${m.meet_url}` : ''].filter(Boolean).join('. '),
    visit_at: m.starts_at,
  };
  if (visitId) { await db.from('lead_visits').update(row).eq('id', visitId); return visitId; }
  const { data } = await db.from('lead_visits').insert({ workspace_id: ws, ...row }).select('id').single();
  return (data as any)?.id ?? null;
}

async function teamNote(ws: string, groupId: string, body: string) {
  await createAdminClient().from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: null, author_name: 'Jadwal', body }).then(() => undefined, () => undefined);
}

/** Sends a message to the lead and keeps it in the chat history. */
async function sayInChat(ws: string, groupId: string, waId: string, text: string, key: string): Promise<boolean> {
  const r = await sendToChat(groupId, waId, text);
  if (r.ok) await createAdminClient().from('wa_messages').insert({ workspace_id: ws, group_id: groupId, body: text, is_from_me: true, dedupe_key: `${key}:${Date.now()}`, sent_at: new Date().toISOString(), source: 'bot', raw: { bot: true } }).then(() => undefined, () => undefined);
  return r.ok;
}

// ---------------------------------------------------------------- moving a meeting
/** Moves a booked meeting to another free time: Google Calendar (same Meet link), the ERP's Meetings, and the confirmation/reminder start over. */
export async function moveMeeting(ws: string, id: string, start: unknown, by: string): Promise<{ ok: true; meeting: Meeting; text: string } | Fail> {
  const db = createAdminClient();
  const { data: cur } = await db.from('chat_meetings').select('*').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!cur || (cur as any).status !== 'booked') return fail(404, 'Meeting not found.');
  const m = cur as Meeting;
  const s = await meetSettings(ws);
  const slot = matchSlot(start, await availableSlots(ws, true));
  if (!slot) return fail(409, 'That time is not free any more. Pick another one.');
  const end = new Date(slot.getTime() + s.minutes * 60000);
  const { data: upd, error } = await db.from('chat_meetings').update({
    starts_at: slot.toISOString(), ends_at: end.toISOString(), confirm_sent_at: null, confirmed_at: null, reminded_at: null, reschedule_offer: null, reschedule_asked_at: null,
  }).eq('id', id).select('*').single();
  if (error || !upd) return fail(/duplicate|unique/i.test(error?.message || '') ? 409 : 500, /duplicate|unique/i.test(error?.message || '') ? 'Someone just took that time. Pick another one.' : error?.message || 'Could not move the meeting.');
  const moved = upd as Meeting;
  forget(`slots:${ws}`);
  const link = await googleLink(ws).catch(() => null);
  if (link && m.google_event_id) { try { await patchEventTime(await accessToken(link.refresh_token), link.calendar_id, m.google_event_id, slot, end); } catch (e) { console.error('google move failed', e); } }
  if (m.owner_id && m.lead_visit_id) await saveVisit(ws, moved, { id: m.owner_id, name: m.owner_name || 'Sales' }, m.lead_visit_id).catch(() => null);
  if (m.group_id) await teamNote(ws, m.group_id, `Jadwal konsultasi dipindah oleh ${by === 'bot' ? 'bot' : by}: ${slotLabel(new Date(m.starts_at))} menjadi ${slotLabel(slot)}.`);
  return { ok: true, meeting: moved, text: movedText(slot, s.minutes, moved.meet_url) };
}

// ---------------------------------------------------------------- before the meeting
/**
 * The clock: an hour before a meeting, the lead is asked to confirm (YA) or to move it (GANTI); 15 minutes before, the link is sent.
 * Each goes once (claimed first, so two clock calls never send twice). A meeting booked less than 70 minutes ahead only gets the reminder.
 */
export async function runMeetingMessages(): Promise<number> {
  const db = createAdminClient();
  const now = Date.now();
  const cols = 'id, workspace_id, group_id, lead_name, starts_at, created_at, meet_url, wa_groups(wa_id)';
  let sent = 0;
  const target = (m: any) => { const g = Array.isArray(m.wa_groups) ? m.wa_groups[0] : m.wa_groups; return m.group_id && g?.wa_id ? String(g.wa_id) : null; };

  const { data: confirm } = await db.from('chat_meetings').select(cols).eq('status', 'booked').is('confirm_sent_at', null)
    .gt('starts_at', new Date(now).toISOString()).lte('starts_at', new Date(now + 60 * 60000).toISOString()).limit(30);
  for (const m of (confirm || []) as any[]) {
    const { data: claimed } = await db.from('chat_meetings').update({ confirm_sent_at: new Date().toISOString() }).eq('id', m.id).is('confirm_sent_at', null).select('id');
    if (!claimed?.length || !shouldAskConfirm(new Date(m.created_at), new Date(m.starts_at))) continue;
    const to = target(m);
    if (to && (await sayInChat(m.workspace_id, m.group_id, to, confirmText(new Date(m.starts_at), m.lead_name || ''), `confirm:${m.id}`))) sent++;
  }

  const { data: remind } = await db.from('chat_meetings').select(cols).eq('status', 'booked').is('reminded_at', null)
    .gt('starts_at', new Date(now).toISOString()).lte('starts_at', new Date(now + 15 * 60000).toISOString()).limit(30);
  for (const m of (remind || []) as any[]) {
    const { data: claimed } = await db.from('chat_meetings').update({ reminded_at: new Date().toISOString() }).eq('id', m.id).is('reminded_at', null).select('id');
    if (!claimed?.length) continue;
    const to = target(m);
    if (to && (await sayInChat(m.workspace_id, m.group_id, to, remindText(new Date(m.starts_at), m.meet_url, m.lead_name || ''), `remind:${m.id}`))) sent++;
  }
  return sent;
}

/**
 * A lead's short reply about their upcoming meeting: YA confirms (when we asked), GANTI offers 3 other free times numbered, a number moves the
 * meeting there, BATAL cancels it. Returns true when the reply was about the meeting (then the bot does not also answer). Rules in meet-rules.ts.
 */
export async function handleMeetingReply(ws: string, groupId: string, waId: string, body: string): Promise<boolean> {
  const m = await upcomingFor(groupId);
  if (!m) return false;
  const asked = m.reschedule_asked_at ? new Date(m.reschedule_asked_at).getTime() : 0;
  const offer = Array.isArray(m.reschedule_offer) && Date.now() - asked < 24 * 3600000 ? m.reschedule_offer : [];
  const r = readMeetingReply(body, { askedConfirm: !!m.confirm_sent_at && !m.confirmed_at, offered: offer.length });
  if (!r) return false;
  const db = createAdminClient();
  const start = new Date(m.starts_at);
  const offerNew = async (lead: string) => {
    const free = (await availableSlots(ws, true)).filter((d) => d.getTime() !== start.getTime());
    const three = offerSlots(free, 3);
    if (!three.length) {
      await sayInChat(ws, groupId, waId, noTimeText, `resched:${m.id}`);
      await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'human', reason: 'The lead wants another meeting time and none is free.', updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
      await teamNote(ws, groupId, 'Lead minta ganti jadwal, tapi tidak ada waktu kosong: tolong hubungi lead.');
      return;
    }
    await db.from('chat_meetings').update({ reschedule_offer: three.map((d) => d.toISOString()), reschedule_asked_at: new Date().toISOString() }).eq('id', m.id);
    await sayInChat(ws, groupId, waId, `${lead}${rescheduleText(three)}`, `resched:${m.id}`);
  };

  if (r.kind === 'confirm') {
    await db.from('chat_meetings').update({ confirmed_at: new Date().toISOString() }).eq('id', m.id);
    await sayInChat(ws, groupId, waId, confirmedText(start), `confirmed:${m.id}`);
    await teamNote(ws, groupId, `Lead mengonfirmasi hadir: ${slotLabel(start)}.`);
  } else if (r.kind === 'reschedule') {
    await teamNote(ws, groupId, 'Lead minta ganti jadwal konsultasi.');
    await offerNew('');
  } else if (r.kind === 'pick') {
    const mv = await moveMeeting(ws, m.id, offer[r.n - 1], 'Lead (lewat chat)');
    if (mv.ok) await sayInChat(ws, groupId, waId, mv.text, `moved:${m.id}`);
    else await offerNew('Maaf kak, waktu itu barusan terisi. ');
  } else {
    await setMeetingStatus(ws, m.id, 'cancelled');
    await sayInChat(ws, groupId, waId, cancelledText, `cancelled:${m.id}`);
    await teamNote(ws, groupId, `Lead membatalkan konsultasi ${slotLabel(start)}.`);
  }
  return true;
}

export { slotLabel };
