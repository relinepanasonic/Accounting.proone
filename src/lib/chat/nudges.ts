import { createAdminClient } from '@/lib/api/supabase-admin';
import { inWindow } from './broadcast-rules';
import { bcSettings } from './broadcasts';
import { availableSlots, bookMeeting, meetSettings, upcomingFor } from './meetings';
import { offerSlots, rescheduleText } from './meet-rules';
import { dueNudge, LATE_MS, NUDGE_DEFAULTS, nudgeText, OFFER_VALID_MS, parseHours, readPick, type NudgeRecord, type NudgeSettings } from './nudge-rules';
import { sendToChat } from './send-any';

/**
 * Follow-up nudges (server side). The clock looks for WhatsApp leads of the sales number who went quiet after our last answer, never booked a
 * consultation, did not say STOP and are not with the team (handed over); each gets the due nudge with three free times. Only inside the broadcast
 * time window. A number in reply books that time. Instagram and Messenger are left out (Meta allows no message 24 hours after the lead's last one).
 * Rules in nudge-rules.ts (tested).
 */
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });
const PER_TICK = 5;

export async function nudgeSettings(ws: string): Promise<NudgeSettings> {
  const { data } = await createAdminClient().from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle();
  const r: any = data || {};
  const hours = r.nudge_hours != null ? parseHours(r.nudge_hours) : NUDGE_DEFAULTS.hours;
  return { enabled: r.nudge_enabled === true, hours: hours.length ? hours : NUDGE_DEFAULTS.hours };
}

export async function saveNudgeSettings(ws: string, p: { enabled?: unknown; hours?: unknown }): Promise<{ ok: true } | Fail> {
  const row: Record<string, unknown> = { workspace_id: ws, updated_at: new Date().toISOString() };
  if (typeof p.enabled === 'boolean') row.nudge_enabled = p.enabled;
  if (p.hours !== undefined) { const h = parseHours(p.hours); if (!h.length) return fail(400, 'Pick when the follow-ups go out.'); row.nudge_hours = h.join(','); }
  const { error } = await createAdminClient().from('wa_bot_config').upsert(row, { onConflict: 'workspace_id' });
  return error ? fail(500, /column/.test(error.message) ? 'The follow-up tables are not in the database yet: run the follow-up SQL first.' : error.message) : { ok: true };
}

/** For Jadwal: the settings, and what the follow-ups did in the last 30 days. */
export async function nudgeSummary(ws: string) {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [settings, sent, booked] = await Promise.all([
    nudgeSettings(ws),
    db.from('chat_nudges').select('group_id', { count: 'exact', head: true }).eq('workspace_id', ws).gte('last_sent_at', since).then((r) => r.count ?? 0, () => 0),
    db.from('chat_nudges').select('group_id', { count: 'exact', head: true }).eq('workspace_id', ws).gte('booked_at', since).then((r) => r.count ?? 0, () => 0),
  ]);
  return { ...settings, chats30d: sent, booked30d: booked };
}

async function say(ws: string, groupId: string, waId: string, text: string, key: string, raw: Record<string, unknown>): Promise<boolean> {
  const db = createAdminClient();
  const r = await sendToChat(groupId, waId, text);
  if (!r.ok) return false;
  const at = new Date().toISOString();
  await db.from('wa_messages').insert({ workspace_id: ws, group_id: groupId, body: text, is_from_me: true, dedupe_key: `${key}:${Date.now()}`, sent_at: at, source: 'bot', raw: { bot: true, ...raw } }).then(() => undefined, () => undefined);
  await db.from('wa_groups').update({ last_message_at: at }).eq('id', groupId).then(() => undefined, () => undefined);
  return true;
}

// ---------------------------------------------------------------- the clock
interface Candidate { workspace_id: string; group_id: string; wa_id: string; name: string | null; last_in: string }

/** Sends the nudges that are due (a few per company per tick). Returns how many went out. Never throws. */
export async function runNudges(now = new Date()): Promise<number> {
  const db = createAdminClient();
  const since = new Date(now.getTime() - (168 * 3600000 + LATE_MS)).toISOString();
  const { data, error } = await db.rpc('chat_nudge_candidates', { p_since: since });
  if (error) { if (!/function|does not exist/i.test(error.message)) console.error('nudge candidates failed', error.message); return 0; }
  const byWs = new Map<string, Candidate[]>();
  for (const c of (data || []) as Candidate[]) byWs.set(c.workspace_id, [...(byWs.get(c.workspace_id) || []), c]);
  let sent = 0;
  for (const [ws, list] of byWs) {
    try { sent += await nudgeWorkspace(ws, list, now); } catch (e) { console.error('nudges failed', e); }
  }
  return sent;
}

async function nudgeWorkspace(ws: string, list: Candidate[], now: Date): Promise<number> {
  const db = createAdminClient();
  const [ns, bc] = await Promise.all([nudgeSettings(ws), bcSettings(ws)]);
  if (!ns.enabled || !inWindow(now, bc)) return 0;
  const { data: recs } = await db.from('chat_nudges').select('group_id, inbound_at, sent, total').in('group_id', list.map((c) => c.group_id));
  const recOf = new Map(((recs || []) as any[]).map((r) => [r.group_id as string, { inboundAt: r.inbound_at, sent: r.sent ?? 0, total: r.total ?? 0 } as NudgeRecord]));
  const due = list.map((c) => ({ c, idx: dueNudge(ns.hours, new Date(c.last_in), recOf.get(c.group_id) ?? null, now) })).filter((x) => x.idx !== null).slice(0, PER_TICK);
  if (!due.length) return 0;
  const [ms, free] = await Promise.all([meetSettings(ws), availableSlots(ws, true)]);
  const three = offerSlots(free, 3);
  if (!three.length) return 0;            // no free times: nothing to offer (they go out once the calendar has room)
  let sent = 0;
  for (const { c, idx } of due) {
    const rec = recOf.get(c.group_id) ?? null;
    const row = { inbound_at: c.last_in, sent: (idx as number) + 1, total: (rec?.total ?? 0) + 1, last_sent_at: now.toISOString(), offer: three.map((d) => d.toISOString()), offer_at: now.toISOString() };
    // claim it first (the total only goes up once), so two clock calls never send the same nudge
    const claim = rec
      ? await db.from('chat_nudges').update(row).eq('group_id', c.group_id).eq('total', rec.total).select('group_id')
      : await db.from('chat_nudges').insert({ group_id: c.group_id, workspace_id: ws, ...row }).select('group_id');
    if (claim.error || !claim.data?.length) continue;
    if (await say(ws, c.group_id, c.wa_id, nudgeText(idx as number, c.name, three, ms.minutes), `nudge:${c.group_id}`, { nudge: (idx as number) + 1 })) sent++;
  }
  return sent;
}

// ---------------------------------------------------------------- the lead answers with a number
/** A lead answered a nudge with the number of a time: book it and send the time and link. Returns true when handled (the bot then stays quiet). */
export async function handleNudgeReply(ws: string, groupId: string, waId: string, body: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: rec } = await db.from('chat_nudges').select('offer, offer_at').eq('group_id', groupId).maybeSingle();
  const offer = Array.isArray((rec as any)?.offer) ? ((rec as any).offer as string[]) : [];
  if (!offer.length || !(rec as any)?.offer_at || Date.now() - new Date((rec as any).offer_at).getTime() > OFFER_VALID_MS) return false;
  const n = readPick(body, offer.length);
  if (!n) return false;
  if (await upcomingFor(groupId)) return false;
  const { data: bot } = await db.from('wa_bot_chats').select('lead').eq('group_id', groupId).maybeSingle();
  const lead = ((bot as any)?.lead || {}) as { name?: string; store?: string };
  const r = await bookMeeting(ws, { groupId, start: offer[n - 1], leadName: lead.name, store: lead.store, by: 'bot' });
  if (r.ok) {
    await db.from('chat_nudges').update({ offer: null, booked_at: new Date().toISOString() }).eq('group_id', groupId);
    await say(ws, groupId, waId, `Siap kak, ${r.text.charAt(0).toLowerCase()}${r.text.slice(1)}`, `nudge-booked:${groupId}`, { booked: r.meeting.id });
    return true;
  }
  const three = offerSlots(await availableSlots(ws, true), 3);
  if (!three.length) return false;        // nothing free: the bot (or the team) answers
  await db.from('chat_nudges').update({ offer: three.map((d) => d.toISOString()), offer_at: new Date().toISOString() }).eq('group_id', groupId);
  await say(ws, groupId, waId, `Maaf kak, waktu itu barusan terisi. ${rescheduleText(three)}`, `nudge-retry:${groupId}`, {});
  return true;
}
