// Mission Control: everything the 7 tabs show, plus running due schedules. Server-side only.
import { getOfficeState, submitGoal } from '@/lib/ai/office-engine';
import { budgetStatus } from '@/lib/ai/office-extras';
import { costUsd, jakartaMonthStartIso } from '@/lib/ai/costs';
import { isDue } from '@/lib/ai/schedule-rules';

type Db = any;

const isMissingTable = (error: any) => error?.code === 'PGRST205' || error?.code === '42P01';

async function logEvent(db: Db, workspaceId: string, goalId: string | null, message: string) {
  await db.from('ai_task_events').insert({ workspace_id: workspaceId, goal_id: goalId, agent_id: null, message });
}

/** Starts one schedule's brief now. Returns the new goal id, or throws with a readable reason. */
async function startSchedule(db: Db, workspaceId: string, userId: string | null, s: any): Promise<string> {
  const brief = `${s.title}\n\n${s.brief}`;
  try {
    const goalId = await submitGoal(db, workspaceId, userId, brief, false, s.team_id ?? null, s.id);
    await db.from('ai_schedules').update({ last_run_at: new Date().toISOString(), last_goal_id: goalId }).eq('id', s.id);
    await logEvent(db, workspaceId, goalId, `Calendar started "${s.title}".`);
    return goalId;
  } catch (err: any) {
    // Mark it as run anyway, so a blocked job is not retried on every refresh today.
    await db.from('ai_schedules').update({ last_run_at: new Date().toISOString() }).eq('id', s.id);
    await logEvent(db, workspaceId, null, `Calendar could not start "${s.title}": ${err?.message || 'unknown error'}`);
    throw err;
  }
}

/** Queues every schedule that is due now. Safe to call often: a schedule runs at most once a day. */
export async function runDueSchedules(db: Db, workspaceId: string, userId: string | null = null): Promise<number> {
  const { data, error } = await db.from('ai_schedules').select('*').eq('workspace_id', workspaceId).eq('enabled', true);
  if (error) return 0;
  let started = 0;
  for (const s of data || []) {
    if (!isDue(s)) continue;
    try {
      await startSchedule(db, workspaceId, userId, s);
      started++;
    } catch {
      /* already logged */
    }
  }
  return started;
}

export async function runScheduleNow(db: Db, workspaceId: string, userId: string, scheduleId: string) {
  const { data: s } = await db.from('ai_schedules').select('*').eq('id', scheduleId).eq('workspace_id', workspaceId).maybeSingle();
  if (!s) throw new Error('Schedule not found.');
  return startSchedule(db, workspaceId, userId, s);
}

export async function getMissionState(db: Db, workspaceId: string) {
  const base = await getOfficeState(db, workspaceId);

  // Task Board: more briefs than the office view keeps, with their subtasks.
  const { data: goalRows } = await db
    .from('ai_tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('kind', 'goal')
    .order('created_at', { ascending: false })
    .limit(60);
  const goalIds = (goalRows || []).map((g: any) => g.id);
  const { data: subRows } = goalIds.length ? await db.from('ai_tasks').select('*').in('parent_id', goalIds).order('seq') : { data: [] };
  const goals = (goalRows || []).map((g: any) => {
    const subtasks = (subRows || []).filter((s: any) => s.parent_id === g.id);
    const cost = costUsd(g.model_used, g.tokens_in, g.tokens_out) + subtasks.reduce((n: number, s: any) => n + costUsd(s.model_used, s.tokens_in, s.tokens_out), 0);
    return { ...g, subtasks, cost };
  });

  const { data: events } = await db
    .from('ai_task_events')
    .select('id, goal_id, agent_id, message, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200);

  // Per agent this month: work done, failures, estimated cost. Boss calls are booked on the team's planner.
  const monthStart = jakartaMonthStartIso();
  const { data: monthTasks } = await db
    .from('ai_tasks')
    .select('kind, team_id, agent_id, status, model_used, tokens_in, tokens_out')
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart)
    .limit(5000);
  const agentStats: Record<string, { done: number; failed: number; active: number; cost: number }> = {};
  const bump = (id: string | null | undefined) => (id ? (agentStats[id] ??= { done: 0, failed: 0, active: 0, cost: 0 }) : null);
  for (const t of monthTasks || []) {
    if (t.kind === 'subtask') {
      const st = bump(t.agent_id);
      if (!st) continue;
      if (t.status === 'done') st.done++;
      else if (t.status === 'failed') st.failed++;
      else st.active++;
      st.cost += costUsd(t.model_used, t.tokens_in, t.tokens_out);
    } else {
      const planner = base.agents.find((a: any) => a.kind === 'planner' && (a.team_id ?? null) === (t.team_id ?? null));
      const st = bump(planner?.id);
      if (st) st.cost += costUsd(t.model_used, t.tokens_in, t.tokens_out);
    }
  }

  const mem = await db.from('ai_memories').select('*').eq('workspace_id', workspaceId).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(300);
  const sch = await db.from('ai_schedules').select('*').eq('workspace_id', workspaceId).order('created_at');
  const budget = await budgetStatus(db, workspaceId);

  return {
    ...base,
    goals,
    events: events || [],
    agentStats,
    memories: mem.error ? [] : mem.data || [],
    schedules: sch.error ? [] : sch.data || [],
    budget,
    missionReady: !(isMissingTable(mem.error) || isMissingTable(sch.error)),
  };
}
