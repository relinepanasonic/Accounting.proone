import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendWhatsApp } from '@/lib/wa/send';
import { recordBotMessage } from '@/lib/wa/bot/store';
import { runSalesBot, type BotDevice } from '@/lib/wa/bot/run';
import { inOpenHours } from '@/lib/wa/bot/decide';
import type { ParsedWaMessage } from '@/lib/wa/parse-webhook';
import { findClientByPhone, listAgents } from './data';
import { exampleFlows, isTrigger, planFlow, validateGraph, type FlowContext, type Graph, type Plan, type PlannedAction } from './flow';

/**
 * Scenario flows (server side): storing the drawings, trying one without sending anything, and RUNNING them on a new lead message.
 * The flows sit on top of the normal bot: a message that matches no active flow, or a flow that does not answer, goes to the bot exactly as before.
 * The bot's master switch (WA settings "ON") also controls flows: switched off, nothing is sent automatically. The rules are in flow.ts (tested).
 */

type Who = { userId: string; name: string };
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- storing
/** Keeps only what a drawing may hold (a typed shape, numbers for positions), whatever the browser sent. */
export function cleanGraph(g: any): Graph {
  const nodes = (Array.isArray(g?.nodes) ? g.nodes : []).slice(0, 60).map((n: any) => ({
    id: String(n?.id ?? '').slice(0, 40), type: String(n?.type ?? '') as any,
    x: Math.round(Number(n?.x) || 0), y: Math.round(Number(n?.y) || 0),
    data: n?.data && typeof n.data === 'object' && !Array.isArray(n.data) ? JSON.parse(JSON.stringify(n.data)) : {},
  }));
  const edges = (Array.isArray(g?.edges) ? g.edges : []).slice(0, 120).map((e: any) => ({ id: String(e?.id ?? '').slice(0, 90), from: String(e?.from ?? ''), port: String(e?.port ?? 'out') as any, to: String(e?.to ?? '') }));
  return { nodes, edges };
}

export async function listFlows(ws: string) {
  const db = createAdminClient();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: flows }, { data: runs }] = await Promise.all([
    db.from('bot_flows').select('id, name, description, active, graph, created_by, created_at, updated_at, updated_by').eq('workspace_id', ws).order('created_at', { ascending: true }),
    db.from('bot_flow_runs').select('flow_id').eq('workspace_id', ws).gte('created_at', since).limit(5000),
  ]);
  const count = new Map<string, number>();
  for (const r of (runs || []) as Array<{ flow_id: string | null }>) if (r.flow_id) count.set(r.flow_id, (count.get(r.flow_id) || 0) + 1);
  return ((flows || []) as any[]).map((f) => {
    const g = cleanGraph(f.graph);
    const trigger = g.nodes.find((n) => isTrigger(n.type));
    const { graph, ...rest } = f; void graph;
    return { ...rest, boxes: g.nodes.length, trigger: trigger?.type ?? null, runs7d: count.get(f.id) || 0, problems: validateGraph(g).errors.length };
  });
}

export async function getFlow(ws: string, id: string) {
  const { data } = await createAdminClient().from('bot_flows').select('id, name, description, active, graph, created_by, created_at, updated_at, updated_by').eq('id', id).eq('workspace_id', ws).maybeSingle();
  return data ? { ...(data as any), graph: cleanGraph((data as any).graph) } : null;
}

export async function saveFlow(ws: string, input: { id?: string; name?: unknown; description?: unknown; active?: unknown; graph?: unknown }, by: Who): Promise<{ ok: true; id: string; warnings: string[] } | Fail> {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) return fail(400, 'Give the flow a name.');
  const graph = cleanGraph(input.graph);
  const v = validateGraph(graph);
  const active = input.active === true;
  // A drawing with problems can be saved while it is OFF (work in progress), but never switched on.
  if (v.errors.length && active) return fail(400, `Fix this before switching the flow on: ${v.errors[0]}`);
  const row = { name, description: String(input.description ?? '').trim().slice(0, 300) || null, active, graph, updated_at: new Date().toISOString(), updated_by: by.name };
  const db = createAdminClient();
  if (input.id) {
    const { data, error } = await db.from('bot_flows').update(row).eq('id', input.id).eq('workspace_id', ws).select('id').maybeSingle();
    if (error) return fail(500, error.message);
    if (!data) return fail(404, 'Flow not found.');
    return { ok: true, id: input.id, warnings: v.errors.length ? [...v.errors.map((e) => `Not ready: ${e}`), ...v.warnings] : v.warnings };
  }
  const { data, error } = await db.from('bot_flows').insert({ workspace_id: ws, ...row, created_by: by.name }).select('id').single();
  if (error || !data) return fail(500, error?.message || 'Could not save the flow.');
  return { ok: true, id: (data as any).id, warnings: v.errors.length ? [...v.errors.map((e) => `Not ready: ${e}`), ...v.warnings] : v.warnings };
}

export async function setFlowActive(ws: string, id: string, active: boolean, by: Who): Promise<{ ok: true } | Fail> {
  const flow = await getFlow(ws, id);
  if (!flow) return fail(404, 'Flow not found.');
  if (active) { const v = validateGraph(flow.graph); if (v.errors.length) return fail(400, `Fix this before switching the flow on: ${v.errors[0]}`); }
  const { error } = await createAdminClient().from('bot_flows').update({ active, updated_at: new Date().toISOString(), updated_by: by.name }).eq('id', id).eq('workspace_id', ws);
  return error ? fail(500, error.message) : { ok: true };
}

export async function deleteFlow(ws: string, id: string): Promise<{ ok: true } | Fail> {
  const { error } = await createAdminClient().from('bot_flows').delete().eq('id', id).eq('workspace_id', ws);
  return error ? fail(500, error.message) : { ok: true };
}

/** Creates the four suggested flows (switched OFF), skipping any whose name already exists. */
export async function createExamples(ws: string, by: Who): Promise<{ ok: true; created: number }> {
  const db = createAdminClient();
  const { data: have } = await db.from('bot_flows').select('name').eq('workspace_id', ws);
  const names = new Set(((have || []) as Array<{ name: string }>).map((f) => f.name));
  let created = 0;
  for (const ex of exampleFlows()) {
    if (names.has(ex.name)) continue;
    const { error } = await db.from('bot_flows').insert({ workspace_id: ws, name: ex.name, description: ex.description, active: false, graph: ex.graph, created_by: by.name, updated_by: by.name });
    if (!error) created++;
  }
  return { ok: true, created };
}

export async function listRuns(ws: string, limit = 50) {
  const { data } = await createAdminClient().from('bot_flow_runs').select('id, flow_id, flow_name, group_id, trigger_text, actions, handled, outcome, detail, created_at, wa_groups(name, wa_id)').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(limit);
  return ((data || []) as any[]).map((r) => {
    const g = Array.isArray(r.wa_groups) ? r.wa_groups[0] : r.wa_groups;
    const { wa_groups, ...rest } = r; void wa_groups;
    return { ...rest, chat: String(g?.name || (g?.wa_id ? `+${g.wa_id}` : 'Chat')) };
  });
}

/** "Try it": what a flow WOULD do for a sample message. Nothing is sent or saved. */
export function testFlow(graphIn: unknown, c: Partial<FlowContext>): { ok: true; validation: ReturnType<typeof validateGraph>; plan: Plan } {
  const graph = cleanGraph(graphIn);
  const ctx: FlowContext = {
    message: String(c.message ?? '').slice(0, 500), isFirst: c.isFirst !== false, sourceChannel: c.sourceChannel ? String(c.sourceChannel) : null, sourceId: null,
    inHours: c.inHours !== false, isClient: c.isClient === true, leadName: String(c.leadName ?? 'Budi Santoso').slice(0, 60), persona: String(c.persona ?? 'Fefe').slice(0, 30), company: String(c.company ?? 'Prof Toko Online').slice(0, 60),
  };
  return { ok: true, validation: validateGraph(graph), plan: planFlow(graph, ctx) };
}

// ---------------------------------------------------------------- running on a real message
async function logRun(ws: string, flow: { id: string; name: string }, groupId: string, message: string, actions: string[], handled: boolean, outcome: 'ok' | 'failed', detail: string) {
  try { await createAdminClient().from('bot_flow_runs').insert({ workspace_id: ws, flow_id: flow.id, flow_name: flow.name, group_id: groupId, trigger_text: message.slice(0, 300), actions, handled, outcome, detail: detail.slice(0, 400) }); } catch { /* ignore */ }
}

const firstName = (s: string | null | undefined) => String(s || '').trim().toLowerCase().split(/\s+/)[0] || '';

/**
 * Runs the first matching active flow for a lead's message. Returns { handled: true } when the flow answered the lead itself (a message, the AI, or a
 * hand over), so the normal bot stays quiet; otherwise the normal bot goes on. Never throws.
 */
export async function runFlowsFor(device: BotDevice, m: ParsedWaMessage, groupId: string): Promise<{ handled: boolean; flow?: string }> {
  if (device.role !== 'sales' || m.isGroup || m.isFromMe) return { handled: false };
  const ws = device.workspace_id;
  const db = createAdminClient();
  try {
    const [{ data: cfg }, { data: chat }, { data: flowRows }] = await Promise.all([
      db.from('wa_bot_config').select('enabled, persona_name, company_name, hours_from, hours_to').eq('workspace_id', ws).maybeSingle(),
      db.from('wa_bot_chats').select('status').eq('group_id', groupId).maybeSingle(),
      db.from('bot_flows').select('id, name, graph').eq('workspace_id', ws).eq('active', true).order('created_at', { ascending: true }),
    ]);
    if (!cfg?.enabled) return { handled: false };                                   // the bot's master switch is OFF: nothing automatic
    if (chat?.status === 'human' || chat?.status === 'off') return { handled: false };   // a person has this chat
    const flows = (flowRows || []) as Array<{ id: string; name: string; graph: Graph }>;
    if (!flows.length) return { handled: false };

    const [{ count: inbound }, { data: st }, client, { data: grp }] = await Promise.all([
      db.from('wa_messages').select('id', { count: 'exact', head: true }).eq('group_id', groupId).eq('is_from_me', false),
      db.from('chat_state').select('source_channel, source_id').eq('group_id', groupId).maybeSingle(),
      findClientByPhone(ws, m.chatId),
      db.from('wa_groups').select('name').eq('id', groupId).maybeSingle(),
    ]);
    const ctx: FlowContext = {
      message: m.body || '', isFirst: (inbound ?? 0) <= 1, sourceChannel: (st as any)?.source_channel ?? null, sourceId: (st as any)?.source_id ?? null,
      inHours: inOpenHours(new Date(), cfg.hours_from || '08:00', cfg.hours_to || '21:00'), isClient: !!client,
      leadName: String((grp as any)?.name || m.senderName || ''), persona: cfg.persona_name || 'Fefe', company: cfg.company_name || 'Prof Toko Online',
    };

    for (const f of flows) {
      const graph = cleanGraph(f.graph);
      if (validateGraph(graph).errors.length) continue;                               // a broken drawing never runs
      const plan = planFlow(graph, ctx);
      if (!plan.matched) continue;
      // a keyword flow answers a chat once, not on every message that has the word
      const trigger = graph.nodes.find((n) => isTrigger(n.type));
      if (trigger?.type === 'trigger_keyword') {
        const { count } = await db.from('bot_flow_runs').select('id', { count: 'exact', head: true }).eq('flow_id', f.id).eq('group_id', groupId);
        if ((count ?? 0) > 0) continue;
      }
      const result = await executePlan(plan, { ws, device, m, groupId, flowName: f.name, client });
      await logRun(ws, f, groupId, ctx.message, plan.actions.map((a) => a.kind), result.handled, result.failed ? 'failed' : 'ok', result.detail);
      return { handled: result.handled, flow: f.name };                               // only the first matching flow runs
    }
    return { handled: false };
  } catch (e) {
    console.error('flows failed', e);
    return { handled: false };
  }
}

async function executePlan(plan: Plan, c: { ws: string; device: BotDevice; m: ParsedWaMessage; groupId: string; flowName: string; client: { sales_name: string | null } | null }): Promise<{ handled: boolean; failed: boolean; detail: string }> {
  const db = createAdminClient();
  const notes: string[] = [];
  let handled = false; let failed = false;
  const step = async (a: PlannedAction): Promise<boolean> => {
    switch (a.kind) {
      case 'send': {
        if (!a.text) { notes.push('send: empty text'); return true; }
        await sleep(1500 + Math.floor(Math.random() * 2000));                       // a short pause, so it does not read as a machine
        const r = await sendWhatsApp([c.m.chatId], a.text, { token: process.env.FONNTE_TOKEN_SALES });
        if (!r.ok) { notes.push(`send failed: ${r.detail}`); failed = true; return false; }
        await recordBotMessage(c.ws, c.groupId, c.device.phone, a.text, 'flow');
        await db.from('wa_bot_log').insert({ workspace_id: c.ws, group_id: c.groupId, in_reply_to: (c.m.body || '').slice(0, 500), reply: a.text, handoff: false, ok: true, detail: `Flow: ${c.flowName}` });
        const { data: cur } = await db.from('wa_bot_chats').select('replies, status').eq('group_id', c.groupId).maybeSingle();
        await db.from('wa_bot_chats').upsert({ group_id: c.groupId, workspace_id: c.ws, status: (cur as any)?.status ?? 'bot', replies: ((cur as any)?.replies ?? 0) + 1, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
        handled = true; notes.push('sent a message'); return true;
      }
      case 'ai': {
        const r = await runSalesBot(c.device, c.m, c.groupId);
        notes.push(`AI: ${r.done}`);
        if (r.done.startsWith('replied')) handled = true;
        return true;
      }
      case 'assign': {
        await db.from('chat_state').upsert({ group_id: c.groupId, workspace_id: c.ws, assigned_to: a.userId, assigned_name: a.userName || null, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
        notes.push(`assigned to ${a.userName || a.userId}`); return true;
      }
      case 'assign_client_sales': {
        const want = firstName(c.client?.sales_name);
        const agent = want ? (await listAgents(c.ws)).find((x) => firstName(x.name) === want) : undefined;
        if (!agent) { notes.push("the client's salesperson was not found among the team"); return true; }
        await db.from('chat_state').upsert({ group_id: c.groupId, workspace_id: c.ws, assigned_to: agent.id, assigned_name: agent.name, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
        notes.push(`assigned to ${agent.name}`); return true;
      }
      case 'handover': {
        await db.from('wa_bot_chats').upsert({ group_id: c.groupId, workspace_id: c.ws, status: 'human', reason: a.reason, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
        handled = true; notes.push('handed over to a person'); return true;
      }
      case 'note': {
        if (a.text) await db.from('chat_notes').insert({ workspace_id: c.ws, group_id: c.groupId, author_id: null, author_name: `Flow: ${c.flowName}`.slice(0, 80), body: a.text });
        notes.push('added a note'); return true;
      }
    }
  };
  for (const a of plan.actions) { if (!(await step(a))) break; }
  return { handled, failed, detail: notes.join('; ') };
}
