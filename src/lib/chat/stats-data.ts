import { createAdminClient } from '@/lib/api/supabase-admin';
import { memo } from './cache';
import { computeStats, type Stats, type StatsMessage } from './stats';

/**
 * Reads what the numbers page needs for the sales number's chats and hands it to computeStats (stats.ts, tested). Kept for a minute per period,
 * since the figures do not need to be live to the second. Only the two small flags of a message's raw data are read (bot, sentBy), never the whole payload.
 */
export const ALLOWED_DAYS = [7, 30, 90] as const;

export const loadStats = (ws: string, days: number) => memo(`stats:${ws}:${days}`, 60_000, () => build(ws, days));

async function build(ws: string, days: number): Promise<Stats> {
  const db = createAdminClient();
  const now = new Date();
  const since = new Date(now.getTime() - (days + 2) * 86400000).toISOString();

  const { data: devs } = await db.from('wa_devices').select('id').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  const devIds = ((devs || []) as Array<{ id: string }>).map((d) => d.id);
  const empty = computeStats({ messages: [], chats: [], botChats: [], deals: [], clients: [], reminders: [], unserved: [] }, { days, now });
  if (!devIds.length) return empty;
  const { data: groups } = await db.from('wa_groups').select('id, wa_id').eq('workspace_id', ws).eq('is_group', false).in('device_id', devIds).limit(2000);
  const gs = (groups || []) as Array<{ id: string; wa_id: string }>;
  if (!gs.length) return empty;
  const ids = gs.map((g) => g.id);
  const waOf = new Map(gs.map((g) => [g.id, g.wa_id]));

  const [{ data: msgs }, { data: states }, { data: botChats }, { data: deals }, { data: clients }, { data: reminders }] = await Promise.all([
    db.from('wa_messages').select('group_id, is_from_me, sent_at, source, bot:raw->bot, sentBy:raw->sentBy').eq('workspace_id', ws).in('group_id', ids).gte('sent_at', since).order('sent_at', { ascending: true }).limit(20000),
    db.from('chat_state').select('group_id, first_message_at, assigned_name, source_channel, resolved_at').eq('workspace_id', ws).in('group_id', ids),
    db.from('wa_bot_chats').select('group_id, status, replies, reason').eq('workspace_id', ws).in('group_id', ids),
    db.from('crm_deals').select('client_id, salesman_name, stage, value, created_at, stage_changed_at').eq('workspace_id', ws).limit(5000),
    db.from('clients').select('id, phone').eq('workspace_id', ws).not('phone', 'is', null).limit(5000),
    db.from('chat_reminders').select('due_at, done_at').eq('workspace_id', ws).or(`done_at.is.null,due_at.gte.${since}`).limit(5000),
  ]);

  const messages: StatsMessage[] = ((msgs || []) as any[]).map((m) => ({ group_id: m.group_id, is_from_me: m.is_from_me, sent_at: m.sent_at, source: m.source, raw: { bot: m.bot === true, sentBy: m.sentBy ?? undefined } }));
  const stateOf = new Map(((states || []) as any[]).map((s) => [s.group_id as string, s]));

  // chats waiting right now: the lead wrote last, and the chat is not resolved since
  const last = new Map<string, { lastIn: string | null; runStart: string | null; lastFromMe: boolean }>();
  for (const m of messages) {
    const cur = last.get(m.group_id) || { lastIn: null, runStart: null, lastFromMe: false };
    if (m.is_from_me) { cur.runStart = null; cur.lastFromMe = true; } else { if (!cur.runStart) cur.runStart = m.sent_at; cur.lastIn = m.sent_at; cur.lastFromMe = false; }
    last.set(m.group_id, cur);
  }
  const unserved: Array<{ waitingSince: string }> = [];
  for (const [g, v] of last) {
    if (v.lastFromMe || !v.runStart) continue;
    const res = stateOf.get(g)?.resolved_at as string | null | undefined;
    if (res && v.lastIn && res > v.lastIn) continue;
    unserved.push({ waitingSince: v.runStart });
  }

  return computeStats({
    messages,
    chats: ids.map((g) => { const s = stateOf.get(g); return { group_id: g, first_message_at: s?.first_message_at ?? null, assigned_name: s?.assigned_name ?? null, source_channel: s?.source_channel ?? null, wa_id: waOf.get(g) || '' }; }),
    botChats: (botChats || []) as any[], deals: (deals || []) as any[], clients: (clients || []) as any[], reminders: (reminders || []) as any[], unserved,
  }, { days, now });
}
