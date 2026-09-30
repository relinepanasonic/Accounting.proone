// AI Office engine. Server-side only.
// A goal belongs to a team. The team's planner (Claude) splits it into subtasks, the team's workers do them
// (researchers search the web, installers save skills, doers/specialists write), the planner/QC checks the work,
// and one report is delivered. `tickOffice` does ONE short step per call so it fits inside a serverless function;
// the office page (or a scheduler) calls it repeatedly while work is open.
//
// Agents have NO access to ERP data or actions. They work from the text of the brief, the web (researchers only)
// and the skills installed into them.
import { askBoss, askResearcher, askWorker, describeModelError, providerStatus, type Provider } from '@/lib/ai/providers';

type Db = any; // Supabase client (user session; RLS limits it to founder / superadmin)

export type AgentKind = 'planner' | 'qc' | 'worker' | 'researcher' | 'installer';

export interface OfficeAgent {
  id: string;
  team_id: string | null;
  name: string;
  title: string;
  floor: number;
  kind: AgentKind;
  provider: Provider;
  model: string;
  enabled: boolean;
}

export interface OfficeTeam {
  id: string;
  slug: string;
  name: string;
  mission: string;
  enabled: boolean;
}

export interface OfficeTask {
  id: string;
  team_id: string | null;
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

type RosterEntry = Omit<OfficeAgent, 'id' | 'team_id' | 'enabled'>;

const GENERAL_AGENTS: RosterEntry[] = [
  { name: 'Atlas', title: 'Director (plans the work)', floor: 3, kind: 'planner', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Vera', title: 'Inspector (quality control)', floor: 3, kind: 'qc', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Nova', title: 'Specialist', floor: 2, kind: 'worker', provider: 'gemini', model: 'gemini-3.8-flash' },
  { name: 'Kiro', title: 'Specialist', floor: 2, kind: 'worker', provider: 'gemini', model: 'gemini-3.8-flash' },
  { name: 'Bit', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
  { name: 'Dot', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
  { name: 'Pix', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
  { name: 'Zap', title: 'Doer', floor: 1, kind: 'worker', provider: 'groq', model: 'openai/gpt-oss-20b' },
];

export interface TeamProfile {
  slug: string;
  name: string;
  mission: string;
  roster: RosterEntry[];
  /** Extra guidance for this team's planner. */
  plannerGuide: string;
  /** Extra guidance for the final report. */
  reportGuide: string;
  /** Extra guidance per worker kind. */
  workerGuide: Partial<Record<AgentKind, string>>;
  /** Goals sent to this team run on the deepest boss model. */
  deepByDefault: boolean;
  /** Cap on subtasks per brief (research is the expensive part). */
  maxSubtasks?: number;
}

export const TEAM_PROFILES: Record<string, TeamProfile> = {
  'team-creator': {
    slug: 'team-creator',
    name: 'AI Team Creator',
    mission: 'Design new, specialized AI teams: research what is possible, pick the best model for each job, and equip every agent with the right skills.',
    deepByDefault: false,
    maxSubtasks: 3,
    roster: [
      { name: 'Mentor', title: 'Research Director (boss)', floor: 3, kind: 'planner', provider: 'anthropic', model: 'claude-sonnet-5-5' },
      { name: 'Scout', title: 'Skill & Model Researcher', floor: 2, kind: 'researcher', provider: 'anthropic', model: 'claude-haiku-4-5' },
      { name: 'Forge', title: 'Skill Installer', floor: 1, kind: 'installer', provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
    plannerGuide:
      'You run the AI Team Creator. The owner wants new AI teams that are specialized and skilled. ' +
      'Research ONLY what the brief asks for. If the brief asks about team structure and skills, plan research on skills and team structure; ' +
      'do NOT add model or price comparisons unless the brief asks which AI model to use, or asks you to build or equip the team. ' +
      'Break the brief into research questions for Scout (level "specialist"). Give Scout ONE focused question per subtask, ' +
      'and ask for a short answer (under 250 words). Research is billed per page read, so use as few subtasks as the brief allows (at most 3). ' +
      'Use level "doer" (Forge, the skill installer) only when the brief asks to write or install skills for a named agent; then the subtask must list the agent names and what each skill must teach. ' +
      'Do not invent facts: research is only what Scout finds.',
    reportGuide:
      'Write the final report for a busy owner. Be decisive: give ONE recommendation, not a menu of options. ' +
      'Begin with the direct answer to the brief in 2 or 3 sentences (for example the number of agents and why). ' +
      'Then a short numbered list of the recommended agents, each with its single skill and one line on what it produces. ' +
      'Then the first 2 or 3 steps to start. Keep it under 350 words, short sentences, no tables, no Markdown symbols. ' +
      'Do NOT write paragraphs about source quality, tool limits or what could not be verified. Put everything unverified in ONE final line starting with "Belum terverifikasi:". ' +
      'Add model and price advice only if the brief asked for it.',
    workerGuide: {
      researcher:
        'You are Scout, the skill and model researcher. Search the web for current, specific evidence and answer the ONE question you were given. ' +
        'You have up to 4 searches, so choose your queries carefully and stop searching as soon as you can answer. ' +
        'Give your pick and the reason, and name the source of each claim. If something is missing, say so in one short line; never write about tool or search limits. Keep the answer under 250 words.',
      installer:
        'You are Forge, the skill installer. A skill is a reusable instruction pack for an AI agent: what it does, when to use it, and exact steps, rules and an example. ' +
        'Reply with ONLY a JSON object, no other text, in this shape: ' +
        '{"skills":[{"name":"short-kebab-name","description":"one sentence","suited_for":"jobs it helps with","instructions":"the full instructions, plain text","install_to":["AgentName"]}]}. ' +
        'install_to may be empty if the brief names no agent.',
    },
  },
};

const MAX_SUBTASKS = 6;
const WORKERS_PER_TICK = 4;
const MAX_ATTEMPTS = 2; // first try + one redo after QC feedback
const STALE_MS = 4 * 60 * 1000; // a step still "in progress" after this was cut off by a timeout

const OFFICE_CONTEXT =
  'You work in the AI Office of an Indonesian e-commerce agency ERP (accounting, sales, ads reporting). ' +
  'Agents currently have NO access to company data, files or actions: they work only from the text they are given. ' +
  'Never invent company figures, names or results. If a task needs data nobody provided, say exactly what is missing. ' +
  'Write plain text without Markdown symbols unless told otherwise. Answer in the language the owner used.';

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
const sameTeam = (a: { team_id: string | null }, teamId: string | null) => (a.team_id ?? null) === (teamId ?? null);

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
    .insert(GENERAL_AGENTS.map((a) => ({ ...a, workspace_id: workspaceId })))
    .select('*');
  return { agents: (created || []).sort((a: OfficeAgent, b: OfficeAgent) => b.floor - a.floor || a.name.localeCompare(b.name)), tablesReady: true };
}

async function loadTeams(db: Db, workspaceId: string): Promise<{ teams: OfficeTeam[]; ready: boolean }> {
  const { data, error } = await db.from('ai_teams').select('*').eq('workspace_id', workspaceId).order('created_at');
  if (error) return { teams: [], ready: !isMissingTable(error) };
  return { teams: data || [], ready: true };
}

/** Turns a team on: creates the team and its agents. Safe to call twice. */
export async function activateTeam(db: Db, workspaceId: string, slug: string) {
  const profile = TEAM_PROFILES[slug];
  if (!profile) throw new Error('Unknown team.');

  const { data: existing, error: lookupError } = await db.from('ai_teams').select('id, enabled').eq('workspace_id', workspaceId).eq('slug', slug).maybeSingle();
  if (lookupError) {
    if (isMissingTable(lookupError)) throw new Error('Team tables are missing. Run supabase/migrations/20260930_ai_teams.sql first.');
    throw new Error(lookupError.message);
  }
  if (existing) {
    if (!existing.enabled) await db.from('ai_teams').update({ enabled: true }).eq('id', existing.id);
    return existing.id as string;
  }

  const { data: team, error } = await db
    .from('ai_teams')
    .insert({ workspace_id: workspaceId, slug, name: profile.name, mission: profile.mission })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  // Agent names are unique per workspace; suffix on the rare clash.
  const { data: taken } = await db.from('ai_agents').select('name').eq('workspace_id', workspaceId);
  const used = new Set<string>((taken || []).map((a: { name: string }) => a.name));
  const rows = profile.roster.map((r) => {
    let name = r.name;
    for (let i = 2; used.has(name); i++) name = `${r.name} ${i}`;
    used.add(name);
    return { ...r, name, workspace_id: workspaceId, team_id: team.id };
  });
  const { error: agentError } = await db.from('ai_agents').insert(rows);
  if (agentError) throw new Error(agentError.message);

  await logEvent(db, workspaceId, null, null, `${profile.name} was activated with ${rows.length} agents.`);
  return team.id as string;
}

export async function getOfficeState(db: Db, workspaceId: string) {
  const keys = providerStatus();
  const { agents, tablesReady } = await ensureAgents(db, workspaceId);
  if (!tablesReady) return { setup: { tables: false, teams: false, ...keys }, agents: [], teams: [], skills: [], goals: [], events: [], active: false };

  const { teams, ready: teamsReady } = await loadTeams(db, workspaceId);

  let skills: any[] = [];
  if (teamsReady) {
    const { data: skillRows } = await db.from('ai_skills').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
    const { data: links } = await db.from('ai_agent_skills').select('agent_id, skill_id').eq('workspace_id', workspaceId);
    skills = (skillRows || []).map((s: any) => ({
      ...s,
      agent_ids: (links || []).filter((l: any) => l.skill_id === s.id).map((l: any) => l.agent_id),
    }));
  }

  const { data: goals } = await db
    .from('ai_tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('kind', 'goal')
    .order('created_at', { ascending: false })
    .limit(12);

  const goalIds = (goals || []).map((g: OfficeTask) => g.id);
  const { data: subtasks } = goalIds.length
    ? await db.from('ai_tasks').select('*').in('parent_id', goalIds).order('seq')
    : { data: [] };

  const { data: events } = await db
    .from('ai_task_events')
    .select('id, goal_id, agent_id, message, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(80);

  const withSubtasks = (goals || []).map((g: OfficeTask) => ({
    ...g,
    subtasks: (subtasks || []).filter((s: OfficeTask) => s.parent_id === g.id),
  }));

  return {
    setup: { tables: true, teams: teamsReady, ...keys },
    agents,
    teams,
    skills,
    goals: withSubtasks,
    events: events || [],
    active: withSubtasks.some((g: OfficeTask) => !['done', 'failed'].includes(g.status)),
  };
}

export async function submitGoal(db: Db, workspaceId: string, userId: string | null, brief: string, deepThink: boolean, teamId: string | null) {
  const text = brief.trim();
  const title = text.split('\n')[0].slice(0, 90);

  let team: OfficeTeam | null = null;
  if (teamId) {
    const { data } = await db.from('ai_teams').select('*').eq('id', teamId).eq('workspace_id', workspaceId).maybeSingle();
    if (!data || !data.enabled) throw new Error('That team is not active.');
    team = data;
  }
  const deep = deepThink || Boolean(team && TEAM_PROFILES[team.slug]?.deepByDefault);

  const { data, error } = await db
    .from('ai_tasks')
    .insert({ workspace_id: workspaceId, team_id: teamId, kind: 'goal', title, instructions: text, deep_think: deep, created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await logEvent(db, workspaceId, data.id, null, `New brief for ${team ? team.name : 'the boss'}: "${title}"`);
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

async function planGoal(db: Db, workspaceId: string, goal: OfficeTask, agents: OfficeAgent[], profile: TeamProfile | null) {
  const maxSubtasks = profile?.maxSubtasks ?? MAX_SUBTASKS;
  const planner = agents.find((a) => a.kind === 'planner');
  if (!(await claim(db, goal.id, 'queued', 'planning'))) return;
  await logEvent(db, workspaceId, goal.id, planner?.id || null, `${planner?.name || 'Boss'} is planning${goal.deep_think ? ' (deep think, Opus)' : ''}.`);

  try {
    const { data, model, tokensIn, tokensOut } = await askBoss<{
      approach: string;
      subtasks: { title: string; instructions: string; level: 'doer' | 'specialist' }[];
    }>({
      deep: goal.deep_think,
      effort: 'low',
      system:
        `${OFFICE_CONTEXT}\n\nYou are the Director. Split the owner's brief into at most ${maxSubtasks} small, independent subtasks for the worker floors. ` +
        'Use "doer" for simple, mechanical work (lists, rewriting, formatting, simple drafts) and "specialist" for work that needs judgment, analysis or research. ' +
        'Prefer fewer subtasks; a simple brief may need only one. Each subtask must be fully self-contained: copy into its instructions every fact from the brief the worker needs.' +
        (profile ? `\n\n${profile.plannerGuide}` : ''),
      prompt: `Owner's brief:\n\n${goal.instructions}`,
      schema: PLAN_SCHEMA,
    });

    const subtasks = (data.subtasks || []).slice(0, maxSubtasks);
    if (subtasks.length === 0) throw new Error('The boss produced no subtasks.');

    const byFloor = (floor: number) => agents.filter((a) => a.kind !== 'planner' && a.kind !== 'qc' && a.floor === floor && a.enabled);
    const counters: Record<number, number> = { 1: 0, 2: 0 };
    const rows = subtasks.map((s, i) => {
      let floor = s.level === 'specialist' ? 2 : 1;
      if (byFloor(floor).length === 0) floor = floor === 2 ? 1 : 2;
      const team = byFloor(floor);
      const agent = team.length ? team[counters[floor]++ % team.length] : null;
      return {
        workspace_id: workspaceId, team_id: goal.team_id, parent_id: goal.id, kind: 'subtask', seq: i + 1,
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

/** Pulls the first JSON object out of a model answer (models sometimes wrap it in text or a code fence). */
function extractJson(text: string): any | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Saves the skills an installer wrote and installs them into the named agents. Returns a readable summary. */
async function installSkills(db: Db, workspaceId: string, installer: OfficeAgent, text: string, goalId: string | null) {
  const parsed = extractJson(text);
  const list: any[] = Array.isArray(parsed?.skills) ? parsed.skills : [];
  if (list.length === 0) return 'No skills were saved: the answer was not in the expected format.';

  const { data: allAgents } = await db.from('ai_agents').select('id, name').eq('workspace_id', workspaceId);
  const byName = new Map<string, string>((allAgents || []).map((a: { id: string; name: string }) => [a.name.toLowerCase(), a.id]));
  const lines: string[] = [];

  for (const s of list.slice(0, 10)) {
    const name = String(s?.name || '').trim().slice(0, 80);
    const instructions = String(s?.instructions || '').trim();
    if (!name || !instructions) continue;

    const { data: skill, error } = await db
      .from('ai_skills')
      .upsert(
        {
          workspace_id: workspaceId, name, description: String(s.description || '').slice(0, 300),
          suited_for: String(s.suited_for || '').slice(0, 300), instructions: instructions.slice(0, 6000), created_by: installer.name,
        },
        { onConflict: 'workspace_id,name' }
      )
      .select('id')
      .single();
    if (error || !skill) {
      lines.push(`${name}: could not be saved (${error?.message || 'unknown error'}).`);
      continue;
    }

    const installed: string[] = [];
    const missing: string[] = [];
    for (const target of Array.isArray(s.install_to) ? s.install_to : []) {
      const agentId = byName.get(String(target).toLowerCase());
      if (!agentId) { missing.push(String(target)); continue; }
      await db.from('ai_agent_skills').upsert({ agent_id: agentId, skill_id: skill.id, workspace_id: workspaceId }, { onConflict: 'agent_id,skill_id' });
      installed.push(String(target));
    }
    const note = `${name}: saved${installed.length ? `, installed into ${installed.join(', ')}` : ', not installed into any agent yet'}${missing.length ? ` (no agent named ${missing.join(', ')})` : ''}.`;
    lines.push(note);
    await logEvent(db, workspaceId, goalId, installer.id, `${installer.name} ${note}`);
  }
  return lines.length ? lines.join('\n') : 'No skills were saved: the answer had no usable skills.';
}

async function runSubtask(db: Db, workspaceId: string, task: OfficeTask, agents: OfficeAgent[], profile: TeamProfile | null) {
  const agent = agents.find((a) => a.id === task.agent_id) || agents.find((a) => a.kind !== 'planner' && a.kind !== 'qc' && a.floor === task.floor);
  if (!agent) {
    await setTask(db, task.id, { status: 'failed', error: 'No worker available on this floor.' });
    return;
  }
  if (!(await claim(db, task.id, 'queued', 'running', { attempts: task.attempts + 1, agent_id: agent.id }))) return;
  await logEvent(db, workspaceId, task.parent_id, agent.id, `${agent.name} started "${task.title}"${task.attempts > 0 ? ' (redo)' : ''}.`);

  try {
    // Installed skills become part of the agent's own instructions.
    const { data: links } = await db.from('ai_agent_skills').select('skill_id').eq('agent_id', agent.id);
    let skillBlock = '';
    if (links && links.length > 0) {
      const { data: skills } = await db.from('ai_skills').select('name, instructions').in('id', links.map((l: { skill_id: string }) => l.skill_id));
      skillBlock = (skills || []).map((s: { name: string; instructions: string }) => `Skill "${s.name}":\n${s.instructions}`).join('\n\n');
    }

    const redo = task.qc_feedback
      ? `\n\nYour previous answer was rejected by quality control. Fix this:\n${task.qc_feedback}\n\nYour previous answer:\n${task.result || '(none)'}`
      : '';
    const role = profile?.workerGuide[agent.kind] || `You are ${agent.name}, a ${agent.floor === 2 ? 'specialist' : 'doer'}. Do exactly the one task below and return only the finished work.`;
    const system = `${OFFICE_CONTEXT}\n\n${role}${skillBlock ? `\n\nYour installed skills. Follow them when relevant:\n${skillBlock}` : ''}`;
    const prompt = `Task: ${task.title}\n\n${task.instructions}${redo}`;

    const out =
      agent.kind === 'researcher'
        ? await askResearcher({ model: agent.provider === 'anthropic' ? agent.model : 'claude-sonnet-5-5', system, prompt })
        : await askWorker({ provider: agent.provider, model: agent.model, system, prompt });

    let result = out.text;
    if (agent.kind === 'installer') {
      const summary = await installSkills(db, workspaceId, agent, out.text, task.parent_id);
      result = `${summary}\n\n--- Skill data ---\n${out.text}`;
    }

    await setTask(db, task.id, {
      status: 'review', result, error: null, model_used: out.model,
      tokens_in: task.tokens_in + out.tokensIn, tokens_out: task.tokens_out + out.tokensOut,
    });
    await logEvent(db, workspaceId, task.parent_id, agent.id, `${agent.name} finished "${task.title}".${'note' in out && out.note ? ` ${out.note}` : ''}`);
  } catch (err) {
    const message = describeModelError(err);
    const final = task.attempts + 1 >= MAX_ATTEMPTS;
    await setTask(db, task.id, { status: final ? 'failed' : 'queued', error: message });
    await logEvent(db, workspaceId, task.parent_id, agent.id, `${agent.name} failed "${task.title}": ${message}${final ? '' : ' Retrying.'}`);
  }
}

async function reviewGoal(db: Db, workspaceId: string, goal: OfficeTask, subtasks: OfficeTask[], agents: OfficeAgent[], profile: TeamProfile | null) {
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
        'Fail a result only for a real problem (wrong, incomplete, invented facts, off-task, claims with no source when a source was required), and say exactly what to fix. ' +
        'Then write the final report for the owner from the work that passed. State plainly anything that could not be done and why ' +
        '(for example, company data the agents cannot access yet). Do not claim work that was not done.' +
        (profile ? `\n\n${profile.reportGuide}` : ''),
      prompt: `Owner's brief:\n\n${goal.instructions}\n\nWork from the floors:\n\n${work}`,
      schema: QC_SCHEMA,
    });

    let redo = 0;
    for (const s of subtasks) {
      if (s.status !== 'review') continue;
      const verdict = data.verdicts.find((v) => v.seq === s.seq);
      // Research is the expensive step: accept it with QC's note instead of paying for a second run.
      const isResearch = agents.find((a) => a.id === s.agent_id)?.kind === 'researcher';
      if (verdict && !verdict.pass && s.attempts < MAX_ATTEMPTS && !isResearch) {
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
  const { teams } = await loadTeams(db, workspaceId);

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

  const teamAgents = (teamId: string | null) => agents.filter((a) => sameTeam(a, teamId));
  const profileOf = (teamId: string | null): TeamProfile | null => {
    const team = teams.find((t) => t.id === teamId);
    return team ? TEAM_PROFILES[team.slug] || null : null;
  };

  const { data: subs } = await db.from('ai_tasks').select('*').in('parent_id', goals.map((g) => g.id)).order('seq');
  const subtasks: OfficeTask[] = subs || [];
  const goalById = new Map(goals.map((g) => [g.id, g]));

  // 1. Workers first: finish work already planned.
  const queued = subtasks.filter((s) => s.status === 'queued').slice(0, WORKERS_PER_TICK);
  if (queued.length > 0) {
    await Promise.all(
      queued.map((s) => {
        const teamId = goalById.get(s.parent_id || '')?.team_id ?? s.team_id ?? null;
        return runSubtask(db, workspaceId, s, teamAgents(teamId), profileOf(teamId));
      })
    );
    return { active: true };
  }

  // 2. QC: a goal whose subtasks have all stopped moving.
  const toReview = goals.find((g) => {
    if (g.status !== 'running') return false;
    const mine = subtasks.filter((s) => s.parent_id === g.id);
    return mine.length > 0 && mine.every((s) => ['review', 'done', 'failed'].includes(s.status));
  });
  if (toReview) {
    await reviewGoal(db, workspaceId, toReview, subtasks.filter((s) => s.parent_id === toReview.id), teamAgents(toReview.team_id), profileOf(toReview.team_id));
    return { active: true };
  }

  // 3. Planning: the next brief in the queue.
  const toPlan = goals.find((g) => g.status === 'queued');
  if (toPlan) {
    await planGoal(db, workspaceId, toPlan, teamAgents(toPlan.team_id), profileOf(toPlan.team_id));
    return { active: true };
  }

  return { active: true };
}
