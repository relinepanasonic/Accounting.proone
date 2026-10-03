// Turns a Scout Team recommendation into a real team: team + agents (with job desks and skills) + starter tasks.
// Server-side only. Nothing is created until the owner approves the preview.
import { askBoss } from '@/lib/ai/providers';
import type { Provider } from '@/lib/ai/providers';

type Db = any;

export type BlueprintRole = 'lead' | 'researcher' | 'writer' | 'editor' | 'worker';

export interface BlueprintAgent {
  name: string;
  title: string;
  role: BlueprintRole;
  provider: Provider;
  model: string;
  job_desk: string;
  skill_name: string;
}

export interface BlueprintTask {
  title: string;
  brief: string;
  agent: string;
}

export interface Blueprint {
  name: string;
  mission: string;
  workflow: string;
  agents: BlueprintAgent[];
  tasks: BlueprintTask[];
}

/** The models a custom team may use. Anything else is replaced by Sonnet. */
export const ALLOWED_MODELS: Record<string, { provider: Provider; model: string }> = {
  'claude-opus-5-5': { provider: 'anthropic', model: 'claude-opus-5-5' },
  'claude-sonnet-5-5': { provider: 'anthropic', model: 'claude-sonnet-5-5' },
  'claude-haiku-4-5': { provider: 'anthropic', model: 'claude-haiku-4-5' },
  'gemini-3.8-flash': { provider: 'gemini', model: 'gemini-3.8-flash' },
  'openai/gpt-oss-20b': { provider: 'groq', model: 'openai/gpt-oss-20b' },
  'qwen/qwen3.8-27b:free': { provider: 'openrouter', model: 'qwen/qwen3.8-27b:free' },
  'glm-4.5-flash': { provider: 'zai', model: 'glm-4.5-flash' },
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
};

const ROLES: BlueprintRole[] = ['lead', 'researcher', 'writer', 'editor', 'worker'];
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const BLUEPRINT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short team name, e.g. "Blog SEO Team".' },
    mission: { type: 'string', description: 'One sentence: what this team delivers.' },
    workflow: { type: 'string', description: 'The steps of the work, one per line, numbered.' },
    agents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string', description: 'Short role, e.g. "SEO researcher".' },
          role: { type: 'string', enum: ROLES },
          model: { type: 'string', enum: Object.keys(ALLOWED_MODELS) },
          job_desk: { type: 'string', description: 'What this agent does, step by step, and what it must hand over. Written as instructions to the agent ("You ..."). 60-140 words.' },
          skill_name: { type: 'string', description: 'Short name of the ONE skill this agent carries.' },
        },
        required: ['name', 'title', 'role', 'model', 'job_desk', 'skill_name'],
        additionalProperties: false,
      },
    },
    tasks: {
      type: 'array',
      description: 'Starter tasks the owner can run with one click. Each is a complete brief with placeholders in [BRACKETS] for what the owner must fill in.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          brief: { type: 'string' },
          agent: { type: 'string', description: 'Name of the main agent for this task, or an empty string.' },
        },
        required: ['title', 'brief', 'agent'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'mission', 'workflow', 'agents', 'tasks'],
  additionalProperties: false,
};

/** Cleans a blueprint that came from a model or from the browser. Throws a readable error if it is unusable. */
export function normalizeBlueprint(input: any): Blueprint {
  const name = str(input?.name, 60);
  if (!name) throw new Error('The team needs a name.');
  const rawAgents: any[] = Array.isArray(input?.agents) ? input.agents.slice(0, 8) : [];
  const agents: BlueprintAgent[] = [];
  const seen = new Set<string>();
  for (const a of rawAgents) {
    const agentName = str(a?.name, 40);
    if (!agentName || seen.has(agentName.toLowerCase())) continue;
    seen.add(agentName.toLowerCase());
    const allowed = ALLOWED_MODELS[String(a?.model)] || ALLOWED_MODELS['claude-sonnet-5-5'];
    const role: BlueprintRole = ROLES.includes(a?.role) ? a.role : 'worker';
    agents.push({
      name: agentName,
      title: str(a?.title, 80) || 'Team member',
      role,
      provider: allowed.provider,
      model: allowed.model,
      job_desk: str(a?.job_desk, 1500),
      skill_name: str(a?.skill_name, 60) || `${agentName} skill`,
    });
  }
  if (agents.length === 0) throw new Error('The team needs at least one agent.');

  // Exactly one lead (the first stays) and at most one editor; extras become workers. No lead: the first agent leads.
  for (const role of ['lead', 'editor'] as BlueprintRole[]) {
    let found = false;
    for (const a of agents) {
      if (a.role !== role) continue;
      if (found) a.role = 'worker';
      found = true;
    }
  }
  if (!agents.some((a) => a.role === 'lead')) agents[0].role = 'lead';

  const tasks: BlueprintTask[] = (Array.isArray(input?.tasks) ? input.tasks : [])
    .slice(0, 10)
    .map((t: any) => ({ title: str(t?.title, 120), brief: str(t?.brief, 4000), agent: str(t?.agent, 40) }))
    .filter((t: BlueprintTask) => t.title && t.brief);

  return { name, mission: str(input?.mission, 300) || name, workflow: str(input?.workflow, 2000), agents, tasks };
}

/** Asks the boss model to read the Scout report and turn it into structured team data (preview only, nothing saved). */
export async function proposeBlueprint(brief: string, report: string): Promise<Blueprint> {
  const { data } = await askBoss<any>({
    deep: false,
    effort: 'low',
    system:
      'You turn an AI team recommendation into a team definition for an AI Office. Keep the agents, names, roles and models from the recommendation; only add what is missing. ' +
      'Models you may use: claude-opus-5-5 (hard planning only), claude-sonnet-5-5 (leads, writers, editors), claude-haiku-4-5 (the only one with live web search: researchers), gemini-3.8-flash (bulk drafting), openai/gpt-oss-20b (mechanical formatting), qwen/qwen3.8-27b:free (free, bulk drafting and rewriting), glm-4.5-flash (free GLM, simple drafting), deepseek-chat (very cheap, good writer and coder; servers in China, so no client or financial data). ' +
      "Roles: lead = coordinates and splits the work; researcher = searches the web; writer = produces the main content; editor = checks and improves the others' work (at most one); worker = any other doer. " +
      "Exactly one lead. The editor's job desk is the quality check. Each agent has ONE skill. Write in the language of the recommendation. " +
      "Starter tasks: 2 to 4 ready-to-run briefs that follow the owner's workflow; put placeholders like [KEYWORD LIST] where the owner must provide input, because agents cannot read company data. " +
      'Agents only produce text; if the owner wants automatic publishing, say in the workflow that the final result is delivered as text for the owner to publish.',
    prompt: `Owner's request:\n${brief}\n\nScout Team recommendation:\n${report}`,
    schema: BLUEPRINT_SCHEMA,
  });
  return normalizeBlueprint(data);
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'team';

/** Creates the team, its agents, one skill per agent (the job desk) and the starter tasks. */
export async function createTeamFromBlueprint(db: Db, workspaceId: string, input: unknown): Promise<string> {
  const bp = normalizeBlueprint(input);

  let slug = slugify(bp.name);
  const { data: clash, error: lookupError } = await db.from('ai_teams').select('slug').eq('workspace_id', workspaceId).like('slug', `${slug}%`);
  if (lookupError) throw new Error(lookupError.code === 'PGRST205' ? 'Team tables are missing. Run supabase/migrations/20260930_ai_teams.sql first.' : lookupError.message);
  if ((clash || []).some((c: { slug: string }) => c.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: team, error } = await db
    .from('ai_teams')
    .insert({ workspace_id: workspaceId, slug, name: bp.name, mission: bp.mission, workflow: bp.workflow, starter_tasks: bp.tasks })
    .select('id')
    .single();
  if (error) {
    if (/workflow|starter_tasks/.test(error.message)) throw new Error('Run supabase/migrations/20261005_ai_team_blueprint.sql in Supabase first.');
    throw new Error(error.message);
  }

  // Agent names are unique per workspace; suffix on a clash.
  const { data: taken } = await db.from('ai_agents').select('name').eq('workspace_id', workspaceId);
  const used = new Set<string>((taken || []).map((a: { name: string }) => a.name));
  const rows = bp.agents.map((a) => {
    let name = a.name;
    for (let i = 2; used.has(name); i++) name = `${a.name} ${i}`;
    used.add(name);
    const strong = a.provider === 'anthropic' && a.model !== 'claude-haiku-4-5';
    const kind = a.role === 'lead' ? 'planner' : a.role === 'editor' ? 'qc' : a.role === 'researcher' ? 'researcher' : 'worker';
    const floor = a.role === 'lead' || a.role === 'editor' ? 3 : a.role === 'researcher' || a.role === 'writer' || strong ? 2 : 1;
    return { workspace_id: workspaceId, team_id: team.id, name, title: a.title, floor, kind, provider: a.provider, model: a.model, job_desk: a.job_desk };
  });
  const { data: created, error: agentError } = await db.from('ai_agents').insert(rows).select('id, name');
  if (agentError) {
    await db.from('ai_teams').delete().eq('id', team.id); // do not leave an empty team behind
    throw new Error(/job_desk/.test(agentError.message) ? 'Run supabase/migrations/20261005_ai_team_blueprint.sql in Supabase first.' : agentError.message);
  }

  // The job desk is also saved as the agent's skill, so it shows in the skill library. Match by the final (suffixed) name.
  for (let i = 0; i < bp.agents.length; i++) {
    const agent = (created || []).find((c: { name: string }) => c.name === rows[i].name);
    if (!agent || !bp.agents[i].job_desk) continue;
    const { data: skill } = await db
      .from('ai_skills')
      .upsert(
        { workspace_id: workspaceId, name: `${bp.name} · ${bp.agents[i].skill_name}`.slice(0, 80), description: bp.agents[i].title, suited_for: bp.name, instructions: bp.agents[i].job_desk, created_by: 'Scout Team' },
        { onConflict: 'workspace_id,name' }
      )
      .select('id')
      .single();
    if (skill) await db.from('ai_agent_skills').upsert({ agent_id: agent.id, skill_id: skill.id, workspace_id: workspaceId }, { onConflict: 'agent_id,skill_id' });
  }

  await db.from('ai_task_events').insert({ workspace_id: workspaceId, goal_id: null, agent_id: null, message: `${bp.name} was created from a Scout recommendation with ${rows.length} agents.` });
  return team.id as string;
}
