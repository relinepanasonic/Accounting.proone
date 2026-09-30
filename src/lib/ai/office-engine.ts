// AI Office engine. Server-side only.
// A goal is planned by the boss (Claude), split into subtasks for the worker floors, checked by QC (Claude),
// and closed with one report. `tickOffice` does ONE short step per call so it fits inside a serverless function;
// the office page (or a scheduler) calls it repeatedly while work is open.
//
// v1: agents have NO access to ERP data or actions. They work only from the text of the brief.
import { askBoss, askWorker, describeModelError, providerStatus, type Provider } from '@/lib/ai/providers';

type Db = any; // Supabase client (user session; RLS limits it to founder / superadmin)

export interface OfficeAgent {
  id: string;
  name: string;
  title: string;
  floor: number;
  kind: 'planner' | 'qc' | 'worker';
  provider: Provider;
  model: string;
  enabled: boolean;
}

export interface OfficeTask {
  id: string;
  parent_id: string | null;
  kind: 'goal' | 'subtask';
  seq: number;
  title: string;
  instructions: string;
  floor: number | null;
  agent_id: string | null;
  status: 'queued' | 'planning' | 'running' | 'review' | 'reviewing' | 'done' | 'failed';
  deep_think: boolean;
  result: string | null;
  qc_feedback: string | null;
  error: string | null;
  attempts: number;
  model_used: string | null;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

const DEFAULT_AGENTS: Omit<OfficeAgent, 'id' | 'enabled'>[] = [
  { name: 'Atlas', title: 'Director (plans the work)', floor: 3, kind: 'planner', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Vera', title: 'Inspector (quality control)', floor: 3, kind: 'qc', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Nova', title: 'Specialist', floor: 2, kind: 'worker', provider: 'gemini', model: 'gemini-3.8-flash' },
  { name: 'Kiro', title: 'Specialist', floor: 2, kind: 'worker', provider: 'gemini', model: 'gemini-3.8-flash' },
  { name: 'Bit', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
  { name: 'Dot', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
  { name: 'Pix', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
  { name: 'Zap', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
];

const MAX_SUBTASKS = 6;
const WORKERS_PER_TICK = 4;
const MAX_ATTEMPTS = 2; // first try + one redo after QC feedback
const STALE_MS = 4 * 60 * 1000; // a step still "in progress" after this was cut off by a timeout

const OFFICE_CONTEXT =
  'You work in the AI Office of an Indonesian e-commerce agency ERP (accounting, sales, ads reporting). ' +
  'Agents currently have NO access to company data, files or actions: they work only from the text they are given. ' +
  'Never invent company figures, names or results. If a task needs data nobody provided, say exactly what is missing. ' +
  'Write plain text without Markdown symbols. Answer in the language the owner used.';

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    approach: { type: 'string', description: 'One or two sentences on how the goal will be handled.' },
    subtasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          instructions: { type: 'string', description: 'Complete, self-contained instructions. The worker sees nothing else.' },
          level: { type: 'string', enum: ['doer', 'specialist'] },
        },
        required: ['title', 'instructions', 'level'],
        additionalProperties: false,
      },
    },
  },
  required: ['approach', 'subtasks'],
  additionalProperties: false,
};

const QC_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          seq: { type: 'integer' },
          pass: { type: 'boolean' },
          feedback: { type: 'string', description: 'If not passed: what exactly to fix. Empty if passed.' },
        },
        required: ['seq', 'pass', 'feedback'],
        additionalProperties: false,
      },
    },
    final_report: { type: 'string', description: 'The report for the owner, built from the passed work.' },
  },
  required: ['verdicts', 'final_report'],
  additionalProperties: false,
};

const isMissingTable = (error: any) => error?.code === 'PGRST205' || error?.code === '42P01';

async function logEvent(db: Db, workspaceId: string, goalId: string | null, agentId: string | null, message: string) {
  await db.from('ai_task_events').insert({ workspace_id: workspaceId, goal_id: goalId, agent_id: agentId, message });
}

/** Moves a task from one status to another only if it is still in `from`. False = another run got there first. */
async function claim(db: Db, taskId: string, from: OfficeTask['status'], to: OfficeTask['status'], extra: Record<string, unknown> = {}) {
  const { data } = await db
    .from('ai_tasks')
    .update({ status: to, started_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra })
    .eq('id', taskId)
    .eq('status', from)
    .select('id');
  return Boolean(data && data.length > 0);
}

async function setTask(db: Db, taskId: string, fields: Record<string, unknown>) {
  await db.from('ai_tasks').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', taskId);
}

export async function ensureAgents(db: Db, workspaceId: string): Promise<{ agents: OfficeAgent[]; tablesReady: boolean }> {
  const { data, error } = await db.from('ai_agents').select('*').eq('workspace_id', workspaceId).order('floor', { ascending: false }).order('name');
  if (error) return { agents: [], tablesReady: !isMissingTable(error) };
  if (data.length > 0) return { agents: data, tablesReady: true };

  const { data: created } = await db
    .from('ai_agents')
    .insert(DEFAULT_AGENTS.map((a) => ({ ...a, workspace_id: workspaceId })))
    .select('*');
  return { agents: (created || []).sort((a: OfficeAgent, b: OfficeAgent) => b.floor - a.floor || a.name.localeCompare(b.name)), tablesReady: true };
}

export async function getOfficeState(db: Db, workspaceId: string) {
  const keys = providerStatus();
  const { agents, tablesReady } = await ensureAgents(db, workspaceId);
  if (!tablesReady) return { setup: { tables: false, ...keys }, agents: [], goals: [], events: [], active: false };

  const { data: goals } = await db
    .from('ai_tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('kind', 'goal')
    .order('created_at', { ascending: false })
    .limit(8);

  const goalIds = (goals || []).map((g: OfficeTask) => g.id);
  const { data: subtasks } = goalIds.length
    ? await db.from('ai_tasks').select('*').in('parent_id', goalIds).order('seq')
    : { data: [] };

  const { data: events } = await db
    .from('ai_task_events')
    .select('id, goal_id, agent_id, message, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(60);

  const withSubtasks = (goals || []).map((g: OfficeTask) => ({
    ...g,
    subtasks: (subtasks || []).filter((s: OfficeTask) => s.parent_id === g.id),
  }));

  return {
    setup: { tables: true, ...keys },
    agents,
    goals: withSubtasks,
    events: events || [],
    active: withSubtasks.some((g: OfficeTask) => !['done', 'failed'].includes(g.status)),
  };
}

export async function submitGoal(db: Db, workspaceId: string, userId: string | null, brief: string, deepThink: boolean) {
  const text = brief.trim();
  const title = text.split('\n')[0].slice(0, 90);
  const { data, error } = await db
    .from('ai_tasks')
    .insert({ workspace_id: workspaceId, kind: 'goal', title, instructions: text, deep_think: deepThink, created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await logEvent(db, workspaceId, data.id, null, `New brief for the boss: "${title}"`);
  return data.id as string;
}

/** Steps cut off by a function timeout are put back in the queue (or failed after too many tries). */
async function recoverStale(db: Db, workspaceId: string) {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data: stale } = await db
    .from('ai_tasks')
    .select('id, kind, status, attempts')
    .eq('workspace_id', workspaceId)
    .in('status', ['planning', 'running', 'reviewing'])
    .lt('started_at', cutoff);

  for (const t of stale || []) {
    if (t.kind === 'subtask' && t.status === 'running') {
      if (t.attempts >= MAX_ATTEMPTS + 1) await setTask(db, t.id, { status: 'failed', error: 'Timed out repeatedly.' });
      else await setTask(db, t.id, { status: 'queued' });
    } else if (t.kind === 'goal' && t.status === 'planning') {
      await setTask(db, t.id, { status: 'queued' });
    } else if (t.kind === 'goal' && t.status === 'reviewing') {
      await setTask(db, t.id, { status: 'running' });
    }
  }
}

async function planGoal(db: Db, workspaceId: string, goal: OfficeTask, agents: OfficeAgent[]) {
  const planner = agents.find((a) => a.kind === 'planner');
  if (!(await claim(db, goal.id, 'queued', 'planning'))) return;
  await logEvent(db, workspaceId, goal.id, planner?.id || null, `${planner?.name || 'Boss'} is planning${goal.deep_think ? ' (deep think, Opus)' : ''}.`);

  try {
    const { data, model, tokensIn, tokensOut } = await askBoss<{
      approach: string;
      subtasks: { title: string; instructions: string; level: 'doer' | 'specialist' }[];
    }>({
      deep: goal.deep_think,
      system:
        `${OFFICE_CONTEXT}\n\nYou are the Director. Split the owner's brief into at most ${MAX_SUBTASKS} small, independent subtasks for the worker floors. ` +
        'Use "doer" for simple, mechanical work (lists, rewriting, formatting, simple drafts) and "specialist" for work that needs judgment or analysis. ' +
        'Prefer fewer subtasks; a simple brief may need only one. Each subtask must be fully self-contained: copy into its instructions every fact from the brief the worker needs.',
      prompt: `Owner's brief:\n\n${goal.instructions}`,
      schema: PLAN_SCHEMA,
    });

    const subtasks = (data.subtasks || []).slice(0, MAX_SUBTASKS);
    if (subtasks.length === 0) throw new Error('The boss produced no subtasks.');

    const byFloor = (floor: number) => agents.filter((a) => a.kind === 'worker' && a.floor === floor && a.enabled);
    const counters: Record<number, number> = { 1: 0, 2: 0 };
    const rows = subtasks.map((s, i) => {
      let floor = s.level === 'specialist' ? 2 : 1;
      if (byFloor(floor).length === 0) floor = floor === 2 ? 1 : 2;
      const team = byFloor(floor);
      const agent = team.length ? team[counters[floor]++ % team.length] : null;
      return {
        workspace_id: workspaceId, parent_id: goal.id, kind: 'subtask', seq: i + 1,
        title: s.title.slice(0, 120), instructions: s.instructions, floor, agent_id: agent?.id || null,
      };
    });

    const { error } = await db.from('ai_tasks').insert(rows);
    if (error) throw new Error(error.message);

    await setTask(db, goal.id, { status: 'running', model_used: model, tokens_in: goal.tokens_in + tokensIn, tokens_out: goal.tokens_out + tokensOut });
    await logEvent(db, workspaceId, goal.id, planner?.id || null, `Plan ready: ${rows.length} subtask(s). ${data.approach}`);
  } catch (err) {
    const message = describeModelError(err);
    await setTask(db, goal.id, { status: 'failed', error: message });
    await logEvent(db, workspaceId, goal.id, planner?.id || null, `Planning failed: ${message}`);
  }
}

async function runSubtask(db: Db, workspaceId: string, task: OfficeTask, agents: OfficeAgent[]) {
  const agent = agents.find((a) => a.id === task.agent_id) || agents.find((a) => a.kind === 'worker' && a.floor === task.floor);
  if (!agent) {
    await setTask(db, task.id, { status: 'failed', error: 'No worker available on this floor.' });
    return;
  }
  if (!(await claim(db, task.id, 'queued', 'running', { attempts: task.attempts + 1, agent_id: agent.id }))) return;
  await logEvent(db, workspaceId, task.parent_id, agent.id, `${agent.name} started "${task.title}"${task.attempts > 0 ? ' (redo)' : ''}.`);

  try {
    const redo = task.qc_feedback
      ? `\n\nYour previous answer was rejected by quality control. Fix this:\n${task.qc_feedback}\n\nYour previous answer:\n${task.result || '(none)'}`
      : '';
    const out = await askWorker({
      provider: agent.provider,
      model: agent.model,
      system: `${OFFICE_CONTEXT}\n\nYou are ${agent.name}, a ${agent.floor === 2 ? 'specialist' : 'doer'}. Do exactly the one task below and return only the finished work.`,
      prompt: `Task: ${task.title}\n\n${task.instructions}${redo}`,
    });

    await setTask(db, task.id, {
      status: 'review', result: out.text, error: null, model_used: out.model,
      tokens_in: task.tokens_in + out.tokensIn, tokens_out: task.tokens_out + out.tokensOut,
    });
    await logEvent(db, workspaceId, task.parent_id, agent.id, `${agent.name} finished "${task.title}".${out.note ? ` ${out.note}` : ''}`);
  } catch (err) {
    const message = describeModelError(err);
    const final = task.attempts + 1 >= MAX_ATTEMPTS;
    await setTask(db, task.id, { status: final ? 'failed' : 'queued', error: message });
    await logEvent(db, workspaceId, task.parent_id, agent.id, `${agent.name} failed "${task.title}": ${message}${final ? '' : ' Retrying.'}`);
  }
}

async function reviewGoal(db: Db, workspaceId: string, goal: OfficeTask, subtasks: OfficeTask[], agents: OfficeAgent[]) {
  const qc = agents.find((a) => a.kind === 'qc') || agents.find((a) => a.kind === 'planner');
  if (!(await claim(db, goal.id, 'running', 'reviewing'))) return;
  await logEvent(db, workspaceId, goal.id, qc?.id || null, `${qc?.name || 'QC'} is checking the work.`);

  try {
    const work = subtasks
      .map((s) => `--- Subtask ${s.seq}: ${s.title} [${s.status}]\nInstructions: ${s.instructions}\nResult:\n${s.status === 'failed' ? `(failed: ${s.error || 'no result'})` : s.result || '(empty)'}`)
      .join('\n\n');

    const { data, tokensIn, tokensOut } = await askBoss<{
      verdicts: { seq: number; pass: boolean; feedback: string }[];
      final_report: string;
    }>({
      deep: goal.deep_think,
      system:
        `${OFFICE_CONTEXT}\n\nYou are the Inspector. Check each subtask result against its instructions and the owner's brief. ` +
        'Fail a result only for a real problem (wrong, incomplete, invented facts, off-task), and say exactly what to fix. ' +
        'Then write the final report for the owner from the work that passed. State plainly anything that could not be done and why ' +
        '(for example, company data the agents cannot access yet). Do not claim work that was not done.',
      prompt: `Owner's brief:\n\n${goal.instructions}\n\nWork from the floors:\n\n${work}`,
      schema: QC_SCHEMA,
    });

    let redo = 0;
    for (const s of subtasks) {
      if (s.status !== 'review') continue;
      const verdict = data.verdicts.find((v) => v.seq === s.seq);
      if (verdict && !verdict.pass && s.attempts < MAX_ATTEMPTS) {
        await setTask(db, s.id, { status: 'queued', qc_feedback: verdict.feedback });
        redo++;
      } else {
        await setTask(db, s.id, { status: 'done', qc_feedback: verdict && !verdict.pass ? verdict.feedback : null });
      }
    }

    const usage = { tokens_in: goal.tokens_in + tokensIn, tokens_out: goal.tokens_out + tokensOut };
    if (redo > 0) {
      await setTask(db, goal.id, { status: 'running', ...usage });
      await logEvent(db, workspaceId, goal.id, qc?.id || null, `${qc?.name || 'QC'} sent ${redo} subtask(s) back for a redo.`);
    } else {
      await setTask(db, goal.id, { status: 'done', result: data.final_report, ...usage });
      await logEvent(db, workspaceId, goal.id, qc?.id || null, `${qc?.name || 'QC'} approved the work. Report delivered.`);
    }
  } catch (err) {
    const message = describeModelError(err);
    await setTask(db, goal.id, { status: 'failed', error: message });
    await logEvent(db, workspaceId, goal.id, qc?.id || null, `Quality control failed: ${message}`);
  }
}

/** One short step of office work. Returns whether any goal is still open. */
export async function tickOffice(db: Db, workspaceId: string): Promise<{ active: boolean }> {
  const { agents, tablesReady } = await ensureAgents(db, workspaceId);
  if (!tablesReady) return { active: false };

  await recoverStale(db, workspaceId);

  const { data: openGoals } = await db
    .from('ai_tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('kind', 'goal')
    .in('status', ['queued', 'planning', 'running', 'reviewing'])
    .order('created_at');
  const goals: OfficeTask[] = openGoals || [];
  if (goals.length === 0) return { active: false };

  const { data: subs } = await db.from('ai_tasks').select('*').in('parent_id', goals.map((g) => g.id)).order('seq');
  const subtasks: OfficeTask[] = subs || [];

  // 1. Workers first: finish work already planned.
  const queued = subtasks.filter((s) => s.status === 'queued').slice(0, WORKERS_PER_TICK);
  if (queued.length > 0) {
    await Promise.all(queued.map((s) => runSubtask(db, workspaceId, s, agents)));
    return { active: true };
  }

  // 2. QC: a goal whose subtasks have all stopped moving.
  const toReview = goals.find((g) => {
    if (g.status !== 'running') return false;
    const mine = subtasks.filter((s) => s.parent_id === g.id);
    return mine.length > 0 && mine.every((s) => ['review', 'done', 'failed'].includes(s.status));
  });
  if (toReview) {
    await reviewGoal(db, workspaceId, toReview, subtasks.filter((s) => s.parent_id === toReview.id), agents);
    return { active: true };
  }

  // 3. Planning: the next brief in the queue.
  const toPlan = goals.find((g) => g.status === 'queued');
  if (toPlan) {
    await planGoal(db, workspaceId, toPlan, agents);
    return { active: true };
  }

  return { active: true };
}
