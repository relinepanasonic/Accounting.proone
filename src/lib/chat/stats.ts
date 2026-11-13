import { phoneTail } from './channel';
/**
 * The numbers page of the chat dashboard, the pure part: rows in, figures out. Tested.
 *
 * Reply time: when a lead writes (one message or several in a row), the clock starts at the FIRST of those messages and stops at our next message,
 * by the bot, a flow or a person in the dashboard. Messages a salesperson types on the phone are not captured by Fonnte, so they are not counted.
 * Times are wall-clock (nights and weekends included), and the median is used so one very slow reply does not distort the picture.
 */

export interface StatsMessage { group_id: string; is_from_me: boolean; sent_at: string; source?: string | null; raw?: any }
export interface StatsChat { group_id: string; first_message_at: string | null; assigned_name: string | null; source_channel: string | null; wa_id: string }
export interface StatsBotChat { group_id: string; status: string; replies: number; reason: string | null }
export interface StatsDeal { client_id: string; salesman_name: string | null; stage: string; value: number | string | null; created_at: string | null; stage_changed_at: string | null }
export interface StatsClient { id: string; phone: string | null }
export interface StatsReminder { due_at: string; done_at: string | null }

const BOT = 'Bot';
const DAY = 86400000;

/** Who wrote one of our messages: the bot (or a flow), or the person who sent it from the dashboard. */
export function responderOf(m: StatsMessage): string {
  if (m.raw?.bot === true || m.source === 'bot' || m.source === 'flow') return BOT;
  const n = m.raw?.sentBy?.name;
  return typeof n === 'string' && n.trim() ? n.trim() : 'Team';
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export interface Reply { group_id: string; by: string; minutes: number; at: string }

/** Every reply in the chats, with how long the lead had waited. A message of ours with nobody waiting (a follow-up we started) is not a reply. */
export function repliesOf(messages: StatsMessage[]): Reply[] {
  const byChat = new Map<string, StatsMessage[]>();
  for (const m of messages) { const l = byChat.get(m.group_id) || []; l.push(m); byChat.set(m.group_id, l); }
  const out: Reply[] = [];
  for (const [g, list] of byChat) {
    list.sort((a, b) => a.sent_at.localeCompare(b.sent_at));
    let waitingSince: string | null = null;
    for (const m of list) {
      if (!m.is_from_me) { if (!waitingSince) waitingSince = m.sent_at; continue; }
      if (waitingSince) {
        out.push({ group_id: g, by: responderOf(m), minutes: Math.max(0, (Date.parse(m.sent_at) - Date.parse(waitingSince)) / 60000), at: m.sent_at });
        waitingSince = null;
      }
    }
  }
  return out;
}

const inRange = (iso: string | null | undefined, from: number, to: number) => !!iso && Date.parse(iso) >= from && Date.parse(iso) < to;
const tail9 = phoneTail;
const jakartaDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso));

export interface StatsInput {
  messages: StatsMessage[];          // messages of the sales number's chats (may start before the period, to see who was waiting)
  chats: StatsChat[];
  botChats: StatsBotChat[];
  deals: StatsDeal[];
  clients: StatsClient[];
  reminders: StatsReminder[];        // open and done
  unserved: Array<{ waitingSince: string }>;   // chats waiting right now
}

export interface PersonRow { name: string; chats: number; replies: number; medianMinutes: number | null; leads: number; won: number; wonValue: number }
export interface ChannelFunnel { channel: string; chats: number; leads: number; won: number; wonValue: number }

export interface Stats {
  from: string; to: string; days: number;
  overview: { newChats: number; leadMessages: number; replies: number; medianReply: number | null; medianBot: number | null; medianPeople: number | null; within5: number | null; leads: number; won: number; wonValue: number };
  daily: Array<{ day: string; newChats: number; leadMessages: number; replies: number }>;
  bot: { chatsAnswered: number; replies: number; handedOver: number; stillWithBot: number; reasons: Array<{ reason: string; count: number }> };
  people: PersonRow[];
  funnel: ChannelFunnel[];
  now: { waiting: number; longestWaitMinutes: number | null; overdueFollowups: number };
}

/** Shortens the bot's hand-over reasons into a few readable groups. */
export function reasonGroup(reason: string | null): string {
  const r = String(reason || '').toLowerCase();
  if (!r) return 'Other';
  if (r.includes('replied') || r.includes('took') || r.includes('set by') || r.includes('dashboard')) return 'A salesperson took over';
  if (r.includes('negotiat') || r.includes('price')) return 'Price negotiation';
  if (r.includes('payment') || r.includes('invoice')) return 'Payment';
  if (r.includes('complain') || r.includes('upset')) return 'Complaint';
  if (r.includes('call') || r.includes('meeting')) return 'Wants a call';
  if (r.includes('person')) return 'Asked for a person';
  if (r.includes('already sent') || r.includes('messages')) return 'Bot message limit';
  if (r.includes('could not')) return 'Bot could not answer';
  if (r.includes('client')) return 'Existing client';
  return 'Other';
}

export function computeStats(input: StatsInput, opts: { days: number; now?: Date }): Stats {
  const now = opts.now ?? new Date();
  const to = now.getTime();
  const from = to - opts.days * DAY;

  // replies in the period
  const replies = repliesOf(input.messages).filter((r) => inRange(r.at, from, to));
  const bot = replies.filter((r) => r.by === BOT).map((r) => r.minutes);
  const people = replies.filter((r) => r.by !== BOT).map((r) => r.minutes);
  const all = replies.map((r) => r.minutes);

  // new chats, and which chats belong to which phone
  const newChats = input.chats.filter((c) => inRange(c.first_message_at, from, to));
  const clientByPhone = new Map<string, string>();
  for (const c of input.clients) { const t = tail9(c.phone); if (t.length >= 8 && !clientByPhone.has(t)) clientByPhone.set(t, c.id); }
  const dealsByClient = new Map<string, StatsDeal[]>();
  for (const d of input.deals) { const l = dealsByClient.get(d.client_id) || []; l.push(d); dealsByClient.set(d.client_id, l); }
  const chatDeals = (c: StatsChat) => { const id = clientByPhone.get(tail9(c.wa_id)); return id ? dealsByClient.get(id) || [] : []; };

  // deals made and won in the period, for clients that came through the sales number
  const salesClients = new Set(input.chats.map((c) => clientByPhone.get(tail9(c.wa_id))).filter(Boolean) as string[]);
  const ourDeals = input.deals.filter((d) => salesClients.has(d.client_id));
  const leadsMade = ourDeals.filter((d) => inRange(d.created_at, from, to));
  const wonDeals = ourDeals.filter((d) => d.stage === 'Deal' && inRange(d.stage_changed_at, from, to));

  // per day (Jakarta days)
  const dayKeys: string[] = [];
  for (let t = from + DAY; t <= to + 1; t += DAY) dayKeys.push(jakartaDay(new Date(Math.min(t, to)).toISOString()));
  const uniqDays = Array.from(new Set(dayKeys)).slice(-opts.days);
  const daily = uniqDays.map((day) => ({ day, newChats: 0, leadMessages: 0, replies: 0 }));
  const dayIdx = new Map(daily.map((d, i) => [d.day, i]));
  for (const c of newChats) { const i = dayIdx.get(jakartaDay(c.first_message_at!)); if (i !== undefined) daily[i].newChats++; }
  let leadMessages = 0;
  for (const m of input.messages) if (!m.is_from_me && inRange(m.sent_at, from, to)) { leadMessages++; const i = dayIdx.get(jakartaDay(m.sent_at)); if (i !== undefined) daily[i].leadMessages++; }
  for (const r of replies) { const i = dayIdx.get(jakartaDay(r.at)); if (i !== undefined) daily[i].replies++; }

  // the bot
  const botChats = new Set(replies.filter((r) => r.by === BOT).map((r) => r.group_id));
  const touched = input.botChats.filter((b) => botChats.has(b.group_id) || b.replies > 0);
  const handed = touched.filter((b) => b.status === 'human');
  const reasons = new Map<string, number>();
  for (const b of handed) { const g = reasonGroup(b.reason); reasons.set(g, (reasons.get(g) || 0) + 1); }

  // per person: replies from the dashboard, chats assigned, deals they own
  const names = new Set<string>();
  for (const r of replies) if (r.by !== BOT && r.by !== 'Team') names.add(r.by);
  for (const c of input.chats) if (c.assigned_name) names.add(c.assigned_name);
  for (const d of ourDeals) if (d.salesman_name) names.add(d.salesman_name);
  const first = (s: string) => s.trim().toLowerCase().split(/\s+/)[0];
  const same = (a: string | null, b: string) => !!a && first(a) === first(b);
  const peopleRows: PersonRow[] = Array.from(names).map((name) => {
    const mine = replies.filter((r) => r.by !== BOT && same(r.by, name));
    const won = wonDeals.filter((d) => same(d.salesman_name, name));
    return {
      name, chats: input.chats.filter((c) => same(c.assigned_name, name)).length, replies: mine.length, medianMinutes: median(mine.map((r) => r.minutes)),
      leads: leadsMade.filter((d) => same(d.salesman_name, name)).length, won: won.length, wonValue: won.reduce((s, d) => s + Number(d.value || 0), 0),
    };
  });
  // the same person can appear under a long and a short name: keep one row per first name, the one with the most activity
  const byFirst = new Map<string, PersonRow>();
  for (const p of peopleRows) {
    const k = first(p.name); const cur = byFirst.get(k);
    if (!cur || p.replies + p.chats + p.leads > cur.replies + cur.chats + cur.leads) byFirst.set(k, p);
  }
  const peopleOut = [...byFirst.values()].sort((a, b) => b.replies - a.replies || b.chats - a.chats || a.name.localeCompare(b.name));

  // the funnel per channel: new chats in the period -> got a deal -> won
  const funnelMap = new Map<string, ChannelFunnel>();
  for (const c of newChats) {
    const ch = c.source_channel && c.source_channel !== 'unknown' ? c.source_channel : 'unknown';
    const f = funnelMap.get(ch) || { channel: ch, chats: 0, leads: 0, won: 0, wonValue: 0 };
    f.chats++;
    const ds = chatDeals(c);
    if (ds.length) f.leads++;
    const w = ds.filter((d) => d.stage === 'Deal');
    if (w.length) { f.won++; f.wonValue += w.reduce((s, d) => s + Number(d.value || 0), 0); }
    funnelMap.set(ch, f);
  }

  const waits = input.unserved.map((u) => (to - Date.parse(u.waitingSince)) / 60000).filter((x) => x >= 0);
  return {
    from: new Date(from).toISOString(), to: new Date(to).toISOString(), days: opts.days,
    overview: {
      newChats: newChats.length, leadMessages, replies: replies.length,
      medianReply: median(all), medianBot: median(bot), medianPeople: median(people),
      within5: all.length ? all.filter((x) => x <= 5).length / all.length : null,
      leads: leadsMade.length, won: wonDeals.length, wonValue: wonDeals.reduce((s, d) => s + Number(d.value || 0), 0),
    },
    daily,
    bot: { chatsAnswered: botChats.size, replies: bot.length, handedOver: handed.length, stillWithBot: touched.filter((b) => b.status === 'bot').length, reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count) },
    people: peopleOut,
    funnel: [...funnelMap.values()].sort((a, b) => b.chats - a.chats),
    now: { waiting: input.unserved.length, longestWaitMinutes: waits.length ? Math.max(...waits) : null, overdueFollowups: input.reminders.filter((r) => !r.done_at && Date.parse(r.due_at) <= to).length },
  };
}
