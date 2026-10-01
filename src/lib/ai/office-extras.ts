// Budget and memory for the AI Office. Server-side only. Used by the engine, so it must not import the engine.
import { DEFAULT_MONTHLY_BUDGET_USD, costUsd, fmtUsd, jakartaMonthStartIso } from '@/lib/ai/costs';

type Db = any;

const isMissingTable = (error: any) => error?.code === 'PGRST205' || error?.code === '42P01';

export interface BudgetStatus {
  budget: number;
  spent: number;
  left: number;
  over: boolean;
  ready: boolean; // false until the Mission Control migration has been run
}

/** This month's estimated spend against the monthly limit (Jakarta month). */
export async function budgetStatus(db: Db, workspaceId: string): Promise<BudgetStatus> {
  let budget = DEFAULT_MONTHLY_BUDGET_USD;
  let ready = true;
  const { data: settings, error } = await db.from('ai_office_settings').select('monthly_budget_usd').eq('workspace_id', workspaceId).maybeSingle();
  if (error) ready = !isMissingTable(error);
  else if (settings) budget = Number(settings.monthly_budget_usd);

  const { data: tasks } = await db
    .from('ai_tasks')
    .select('model_used, tokens_in, tokens_out')
    .eq('workspace_id', workspaceId)
    .gte('created_at', jakartaMonthStartIso())
    .limit(5000);
  const spent = (tasks || []).reduce((s: number, t: any) => s + costUsd(t.model_used, t.tokens_in, t.tokens_out), 0);
  return { budget, spent, left: Math.max(0, budget - spent), over: spent >= budget, ready };
}

/** Logs "budget reached" once (not on every tick) and returns true when no new work may start. */
export async function budgetBlocks(db: Db, workspaceId: string): Promise<boolean> {
  const b = await budgetStatus(db, workspaceId);
  if (!b.over) return false;
  const message = `Monthly budget of ${fmtUsd(b.budget)} reached (${fmtUsd(b.spent)} used). New work is paused until next month or until the budget is raised in Mission Control.`;
  const { data: last } = await db.from('ai_task_events').select('message').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1);
  if (!last?.[0]?.message?.startsWith('Monthly budget of')) {
    await db.from('ai_task_events').insert({ workspace_id: workspaceId, goal_id: null, agent_id: null, message });
  }
  return true;
}

const MEMORY_CHARS = 6000;

/**
 * The notes an agent reads before it works: its team's notes (team_id NULL = General Office) that are for the
 * whole team or pinned to this agent. Pinned notes first, newest next, cut to a fixed size.
 */
export async function memoryBlock(db: Db, workspaceId: string, teamId: string | null, agentId: string | null): Promise<string> {
  let q = db.from('ai_memories').select('title, content, agent_id, pinned, updated_at').eq('workspace_id', workspaceId);
  q = teamId ? q.eq('team_id', teamId) : q.is('team_id', null);
  const { data, error } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(40);
  if (error || !data?.length) return '';

  const notes = data.filter((n: any) => !n.agent_id || n.agent_id === agentId);
  let out = '';
  for (const n of notes) {
    const piece = `- ${n.title}: ${n.content}\n`;
    if (out.length + piece.length > MEMORY_CHARS) break;
    out += piece;
  }
  return out ? `Team memory (facts and rules the owner saved; follow them, and never contradict them):\n${out}` : '';
}
