import { createAdminClient } from '@/lib/api/supabase-admin';
import { memo } from './cache';
import { askBotModel } from '@/lib/wa/bot/model';
import { analyze, dailyOf, fallbackSummary, needsOf, parseSummary, summaryInput, SUMMARY_SYSTEM, exampleOf, type BodSummary, type DayCount, type Insights, type NeedCount } from './insights';
import { reasonGroup } from './stats';

/**
 * Reads the sales number's chats and hands the leads' own messages to analyze() (insights.ts, tested). The counts are plain keyword counts; only the
 * short summary for the BOD is written by the AI, from those counts. Kept for 2 minutes per period (the counts) and 6 hours (the summary).
 */
export const INSIGHT_DAYS = [7, 30, 90] as const;

export interface InsightsResult extends Insights {
  days: number; from: string; to: string;
  needs: NeedCount[];                                  // what leads told the bot they need
  daily: DayCount[];                                   // chats and messages per day (Jakarta days)
  handedOver: Array<{ text: string }>;                // the last messages of chats the bot could not answer, to see what is missing from the script
}

export const loadInsights = (ws: string, days: number) => memo(`insights:${ws}:${days}`, 120_000, () => build(ws, days));

async function build(ws: string, days: number): Promise<InsightsResult> {
  const db = createAdminClient();
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const base = { days, from: since, to: now.toISOString() };
  const empty: InsightsResult = { ...base, ...analyze([]), needs: [], daily: dailyOf([], days, now), handedOver: [] };
  const { data: devs } = await db.from('wa_devices').select('id').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  const devIds = ((devs || []) as Array<{ id: string }>).map((d) => d.id);
  if (!devIds.length) return empty;
  const { data: groups } = await db.from('wa_groups').select('id').eq('workspace_id', ws).eq('is_group', false).in('device_id', devIds).limit(3000);
  const { data: ign } = await db.from('chat_state').select('group_id').eq('workspace_id', ws).eq('ignored', true);
  const ignored = new Set(((ign || []) as Array<{ group_id: string }>).map((x) => x.group_id));
  const ids = ((groups || []) as Array<{ id: string }>).map((g) => g.id).filter((id) => !ignored.has(id));      // chats that are not leads are not what clients ask
  if (!ids.length) return empty;
  const [{ data: msgs }, { data: bots }] = await Promise.all([
    db.from('wa_messages').select('group_id, body, sent_at').eq('workspace_id', ws).eq('is_from_me', false).in('group_id', ids).gte('sent_at', since).order('sent_at', { ascending: true }).limit(20000),
    db.from('wa_bot_chats').select('group_id, status, reason, lead').eq('workspace_id', ws).in('group_id', ids),
  ]);
  const messages = (msgs || []) as Array<{ group_id: string; body: string | null; sent_at: string }>;
  const botRows = (bots || []) as Array<{ group_id: string; status: string; reason: string | null; lead: { need?: string } | null }>;
  const inPeriod = new Set(messages.map((m) => m.group_id));
  const needs = needsOf(botRows.filter((b) => inPeriod.has(b.group_id)).map((b) => ({ need: b.lead?.need ?? null })));
  // chats the bot could not answer: the last thing the lead wrote, so the team sees what the script is missing
  const stuck = new Set(botRows.filter((b) => b.status === 'human' && reasonGroup(b.reason) === 'Bot could not answer').map((b) => b.group_id));
  const lastOf = new Map<string, string>();
  for (const m of messages) if (stuck.has(m.group_id) && m.body) lastOf.set(m.group_id, m.body);
  const handedOver = [...lastOf.values()].map(exampleOf).filter((t) => t.length >= 6).slice(-8).map((text) => ({ text }));
  return { ...base, ...analyze(messages), needs, daily: dailyOf(messages, days, now), handedOver };
}

export interface SummaryResult extends BodSummary { model: string | null; ai: boolean }

/**
 * The summary for the BOD, written by the AI from the counts (JSON: executive paragraph, points, actions with a PIC). Kept for 6 hours per period.
 * When the AI is not available, or its answer cannot be read, the summary is written from the numbers alone (ai = false), so the report always has it.
 */
export const loadSummary = (ws: string, days: number, fresh = false) => memo(`insights-sum:${ws}:${days}${fresh ? `:${Date.now()}` : ''}`, 6 * 3600_000, async (): Promise<SummaryResult> => {
  const i = await loadInsights(ws, days);
  if (!i.messages) return { ...fallbackSummary(i, i.needs, days, i.daily), model: null, ai: false };
  try {
    const input = summaryInput(i, i.needs, days, i.daily);
    let out = await askBotModel(SUMMARY_SYSTEM, input);
    let parsed = parseSummary(out.text);
    if (!parsed) { out = await askBotModel(SUMMARY_SYSTEM, `${input}\n\nPENTING: balas HANYA dengan satu objek JSON yang valid.`); parsed = parseSummary(out.text); }
    if (parsed) return { ...parsed, model: out.model, ai: true };
  } catch (e) { console.error('insight summary failed', e); }
  return { ...fallbackSummary(i, i.needs, days, i.daily), model: null, ai: false };
});
