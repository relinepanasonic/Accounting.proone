import { createAdminClient } from '@/lib/api/supabase-admin';
import { accessToken, authUrl, busyTimes, createMeetEvent, deleteEvent, exchangeCode, googleConfigured, makeState } from '@/lib/google/calendar';
import { memo, forget } from './cache';
import { bookedText, freeSlots, matchSlot, MEET_DEFAULTS, offerSlots, parseDays, reminderText, slotCode, slotLabel, validTime, type Busy, type MeetSettings } from './meet-rules';
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
  const run = async () => { const s = await meetSettings(ws); const now = new Date(); return s.enabled ? freeSlots(s, now, await busyFor(ws, s, now)) : []; };
  if (fresh) return run();
  return (await memo(`slots:${ws}`, 60_000, async () => (await run()).map((d) => d.toISOString()))).map((x: string) => new Date(x));
}

/** For the bot: the short list to offer (with the code it must send back), and the lead's own upcoming meeting if there is one. */
export async function meetingContext(ws: string, groupId: string): Promise<{ enabled: boolean; minutes: number; offer: Array<{ code: string; label: string }>; booked: { label: string; meetUrl: string | null } | null }> {
  const s = await meetSettings(ws).catch(() => ({ ...MEET_DEFAULTS }));
  if (!s.enabled) return { enabled: false, minutes: s.minutes, offer: [], booked: null };
  const mine = await upcomingFor(groupId).catch(() => null);
  const offer = mine ? [] : offerSlots(await availableSlots(ws).catch(() => [])).map((d) => ({ code: slotCode(d), label: slotLabel(d) }));
  return { enabled: true, minutes: s.minutes, offer, booked: mine ? { label: slotLabel(new Date(mine.starts_at)), meetUrl: mine.meet_url } : null };
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
export async function bookMeeting(ws: string, input: { groupId: string | null; start: unknown; leadName?: string | null; store?: string | null; by: string }): Promise<{ ok: true; meeting: Meeting; text: string } | Fail> {
  const s = await meetSettings(ws);
  if (!s.enabled) return fail(400, 'Meetings are switched off. Switch them on in Jadwal first.');
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

  if (input.groupId) {
    await db.from('chat_notes').insert({ workspace_id: ws, group_id: input.groupId, author_id: null, author_name: input.by === 'bot' ? 'Bot' : input.by,
      body: `Konsultasi gratis dibooking: ${slotLabel(slot)}${meeting.meet_url ? `. Meet: ${meeting.meet_url}` : ''}${note ? `. ${note}` : ''}` });
  }
  return { ok: true, meeting, text: bookedText(slot, s.minutes, meeting.meet_url) };
}

/** The team books from the inbox: books, then sends the lead the time and link. */
export async function bookFromInbox(ws: string, groupId: string, start: unknown, by: { name: string }): Promise<{ ok: true; meeting: Meeting; sent: boolean; detail: string } | Fail> {
  const db = createAdminClient();
  const { data: g } = await db.from('wa_groups').select('wa_id').eq('id', groupId).eq('workspace_id', ws).maybeSingle();
  if (!g) return fail(404, 'Chat not found.');
  const { data: bot } = await db.from('wa_bot_chats').select('lead').eq('group_id', groupId).maybeSingle();
  const lead = ((bot as any)?.lead || {}) as { name?: string; store?: string };
  const r = await bookMeeting(ws, { groupId, start, leadName: lead.name, store: lead.store, by: by.name });
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
  const { data: m } = await db.from('chat_meetings').select('id, google_event_id, status').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!m) return fail(404, 'Meeting not found.');
  const { error } = await db.from('chat_meetings').update({ status }).eq('id', id);
  if (error) return fail(/duplicate|unique/i.test(error.message) ? 409 : 500, /duplicate|unique/i.test(error.message) ? 'That time is taken by another booking now.' : error.message);
  if (status === 'cancelled' && (m as any).google_event_id) {
    const link = await googleLink(ws).catch(() => null);
    if (link) { try { await deleteEvent(await accessToken(link.refresh_token), link.calendar_id, (m as any).google_event_id); } catch { /* the booking is cancelled anyway */ } }
  }
  forget(`slots:${ws}`);
  return { ok: true };
}

/** The clock: an hour before a meeting, the lead gets a reminder with the link (once). */
export async function sendMeetingReminders(): Promise<number> {
  const db = createAdminClient();
  const now = Date.now();
  const { data } = await db.from('chat_meetings').select('id, workspace_id, group_id, lead_name, starts_at, meet_url, wa_groups(wa_id)').eq('status', 'booked').is('reminded_at', null)
    .gt('starts_at', new Date(now).toISOString()).lte('starts_at', new Date(now + 60 * 60000).toISOString()).limit(30);
  let sent = 0;
  for (const m of (data || []) as any[]) {
    // claim it first, so two clock calls never send twice
    const { data: claimed } = await db.from('chat_meetings').update({ reminded_at: new Date().toISOString() }).eq('id', m.id).is('reminded_at', null).select('id');
    if (!claimed?.length) continue;
    const g = Array.isArray(m.wa_groups) ? m.wa_groups[0] : m.wa_groups;
    if (!m.group_id || !g?.wa_id) continue;
    const text = reminderText(new Date(m.starts_at), m.meet_url, m.lead_name || '');
    const r = await sendToChat(m.group_id, String(g.wa_id), text);
    if (r.ok) {
      await db.from('wa_messages').insert({ workspace_id: m.workspace_id, group_id: m.group_id, body: text, is_from_me: true, dedupe_key: `reminder:${m.id}`, sent_at: new Date().toISOString(), source: 'bot', raw: { bot: true } }).then(() => undefined, () => undefined);
      sent++;
    }
  }
  return sent;
}

export { slotLabel };
