/**
 * Scenario flows, the pure parts (no database, no network). A flow is boxes joined by lines, drawn in the dashboard:
 *   a trigger (a new lead's first message, or a keyword) -> conditions (yes / no lines) -> actions (send a message, let the AI answer, give the chat to a person...).
 * This file checks a drawing and works out WHAT WOULD HAPPEN for a message: planFlow() returns the list of actions in order. Doing them (sending, assigning)
 * is the server's job, so this logic is tested without any of that. The same function powers the "Try it" panel, which sends nothing.
 */

export type NodeType =
  | 'trigger_new_lead' | 'trigger_keyword'
  | 'cond_source' | 'cond_keyword' | 'cond_hours' | 'cond_client'
  | 'act_send' | 'act_ai' | 'act_assign' | 'act_assign_client_sales' | 'act_handover' | 'act_note';

export interface FlowNode { id: string; type: NodeType; x: number; y: number; data: Record<string, any> }
export type Port = 'out' | 'yes' | 'no';
export interface FlowEdge { id: string; from: string; port: Port; to: string }
export interface Graph { nodes: FlowNode[]; edges: FlowEdge[] }

export interface FlowContext {
  message: string;
  isFirst: boolean;             // the lead's first message in this chat
  sourceChannel: string | null; // meta_ads | google_ads | ... | unknown | null
  sourceId: string | null;
  inHours: boolean;             // the team is open now
  isClient: boolean;            // the number belongs to a client in the ERP
  leadName: string;             // the WhatsApp profile name
  persona: string;              // the bot's name
  company: string;
}

export const TRIGGERS: NodeType[] = ['trigger_new_lead', 'trigger_keyword'];
export const CONDITIONS: NodeType[] = ['cond_source', 'cond_keyword', 'cond_hours', 'cond_client'];
export const ACTIONS: NodeType[] = ['act_send', 'act_ai', 'act_assign', 'act_assign_client_sales', 'act_handover', 'act_note'];
export const isCondition = (t: NodeType) => CONDITIONS.includes(t);
export const isTrigger = (t: NodeType) => TRIGGERS.includes(t);
export const portsOf = (t: NodeType): Port[] => (isCondition(t) ? ['yes', 'no'] : isTrigger(t) || ACTIONS.includes(t) ? ['out'] : []);

export const NODE_LABEL: Record<NodeType, string> = {
  trigger_new_lead: 'New lead writes', trigger_keyword: 'Message has a keyword',
  cond_source: 'Lead came from', cond_keyword: 'Message has a keyword', cond_hours: 'Team is open', cond_client: 'Is already a client',
  act_send: 'Send a message', act_ai: 'AI answers', act_assign: 'Give to a salesperson', act_assign_client_sales: "Give to the client's salesperson", act_handover: 'Hand over to a person', act_note: 'Add a team note',
};

// ---------------------------------------------------------------- text helpers
const norm = (s: string) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "harga, berapa; biaya" -> ["harga", "berapa", "biaya"] (normalized, no empty ones). */
export const keywordList = (raw: unknown): string[] => String(raw ?? '').split(/[,;\n]/).map(norm).filter(Boolean);

/** True when the message has any of the keywords, as whole words or phrases ("nego" does not match "negotiation"? it does not: whole words only). */
export function hasKeyword(message: string, keywords: string[]): boolean {
  const m = ` ${norm(message)} `;
  return keywords.some((k) => m.includes(` ${k} `));
}

/** {nama} = the lead's first name (or "kak"), {bot} = the bot's name, {perusahaan} = the company. */
export function fillVars(text: string, ctx: Pick<FlowContext, 'leadName' | 'persona' | 'company'>): string {
  const first = String(ctx.leadName || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)[0] || 'kak';
  return String(text ?? '').replace(/\{nama\}/gi, first).replace(/\{bot\}/gi, ctx.persona).replace(/\{perusahaan\}/gi, ctx.company);
}

// ---------------------------------------------------------------- checking a drawing
export interface Validation { errors: string[]; warnings: string[] }
const MAX_TEXT = 1000;

export function validateGraph(g: Graph): Validation {
  const errors: string[] = []; const warnings: string[] = [];
  const nodes = Array.isArray(g?.nodes) ? g.nodes : [];
  const edges = Array.isArray(g?.edges) ? g.edges : [];
  if (nodes.length === 0) return { errors: ['The flow is empty. Add a trigger first.'], warnings };
  if (nodes.length > 40) errors.push('A flow can have at most 40 boxes.');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) errors.push('Two boxes have the same id.');

  const triggers = nodes.filter((n) => isTrigger(n.type));
  if (triggers.length !== 1) errors.push(triggers.length === 0 ? 'The flow needs a trigger (what starts it).' : 'A flow can have only one trigger.');

  for (const n of nodes) {
    const d = n.data || {};
    const label = NODE_LABEL[n.type] || n.type;
    if (!NODE_LABEL[n.type]) { errors.push(`Unknown box type "${n.type}".`); continue; }
    if ((n.type === 'trigger_keyword' || n.type === 'cond_keyword') && keywordList(d.keywords).length === 0) errors.push(`"${label}": type at least one keyword.`);
    if (n.type === 'cond_source' && !(Array.isArray(d.channels) && d.channels.length) && !d.sourceId) errors.push(`"${label}": pick at least one channel or ad.`);
    if (n.type === 'act_send' || n.type === 'act_note') {
      const t = String(d.text ?? '').trim();
      if (!t) errors.push(`"${label}": write the text.`);
      else if (t.length > MAX_TEXT) errors.push(`"${label}": the text is too long (max ${MAX_TEXT} characters).`);
    }
    if (n.type === 'act_assign' && !d.userId) errors.push(`"${label}": pick the salesperson.`);
  }

  const outPorts = new Set<string>();
  for (const e of edges) {
    const from = byId.get(e.from), to = byId.get(e.to);
    if (!from || !to) { errors.push('A line points to a box that does not exist.'); continue; }
    if (!portsOf(from.type).includes(e.port)) errors.push(`A line leaves "${NODE_LABEL[from.type]}" from a place it does not have.`);
    if (isTrigger(to.type)) errors.push('A line cannot go back into the trigger.');
    const k = `${e.from}:${e.port}`;
    if (outPorts.has(k)) errors.push(`"${NODE_LABEL[from.type]}" has two lines leaving the same point. Keep one.`);
    outPorts.add(k);
  }

  // a loop would never end
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) || []), e.to]);
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const t of next.get(id) || []) if (visit(t)) return true;
    state.set(id, 2);
    return false;
  };
  if (nodes.some((n) => visit(n.id))) errors.push('The lines make a loop. A flow must always move forward.');

  // boxes nobody reaches
  const reached = new Set<string>(triggers.map((t) => t.id));
  const queue = [...reached];
  while (queue.length) { const id = queue.shift()!; for (const t of next.get(id) || []) if (!reached.has(t)) { reached.add(t); queue.push(t); } }
  for (const n of nodes) if (!reached.has(n.id)) warnings.push(`"${NODE_LABEL[n.type] || n.type}" is not connected to the trigger, so it never runs.`);
  for (const n of nodes) if (isCondition(n.type)) {
    const ports = edges.filter((e) => e.from === n.id).map((e) => e.port);
    if (!ports.includes('yes') || !ports.includes('no')) warnings.push(`"${NODE_LABEL[n.type]}": only one answer (yes or no) leads anywhere. For the other, the flow stops and the normal bot continues.`);
  }
  if (!nodes.some((n) => n.type === 'act_send' || n.type === 'act_ai' || n.type === 'act_handover')) warnings.push('Nothing in this flow answers the lead, so the normal bot will still reply.');
  return { errors, warnings };
}

// ---------------------------------------------------------------- what would happen
export type PlannedAction =
  | { kind: 'send'; nodeId: string; text: string }
  | { kind: 'ai'; nodeId: string }
  | { kind: 'assign'; nodeId: string; userId: string; userName: string }
  | { kind: 'assign_client_sales'; nodeId: string }
  | { kind: 'handover'; nodeId: string; reason: string }
  | { kind: 'note'; nodeId: string; text: string };

export interface Plan {
  matched: boolean;
  path: string[];                // box ids in the order they were passed, with the answer of each condition
  decisions: Array<{ nodeId: string; answer: 'yes' | 'no' }>;
  actions: PlannedAction[];
  /** The flow answers the lead itself (a message, the AI, or a hand over): the normal bot must not also reply. */
  handled: boolean;
}

export function conditionAnswer(n: FlowNode, ctx: FlowContext): boolean {
  const d = n.data || {};
  switch (n.type) {
    case 'cond_source': return (Array.isArray(d.channels) && d.channels.includes(ctx.sourceChannel ?? '')) || (!!d.sourceId && d.sourceId === ctx.sourceId);
    case 'cond_keyword': return hasKeyword(ctx.message, keywordList(d.keywords));
    case 'cond_hours': return ctx.inHours;
    case 'cond_client': return ctx.isClient;
    default: return false;
  }
}

export function triggerMatches(n: FlowNode, ctx: FlowContext): boolean {
  if (n.type === 'trigger_new_lead') return ctx.isFirst;
  if (n.type === 'trigger_keyword') return hasKeyword(ctx.message, keywordList(n.data?.keywords));
  return false;
}

const MAX_STEPS = 25;

export function planFlow(g: Graph, ctx: FlowContext): Plan {
  const none: Plan = { matched: false, path: [], decisions: [], actions: [], handled: false };
  const nodes = g?.nodes || []; const edges = g?.edges || [];
  const trigger = nodes.find((n) => isTrigger(n.type));
  if (!trigger || !triggerMatches(trigger, ctx)) return none;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const plan: Plan = { matched: true, path: [trigger.id], decisions: [], actions: [], handled: false };
  const seen = new Set<string>([trigger.id]);
  let cur: FlowNode | undefined = trigger;
  let port: Port = 'out';

  for (let i = 0; i < MAX_STEPS && cur; i++) {
    const edge = edges.find((e) => e.from === cur!.id && e.port === port);
    const nxt = edge ? byId.get(edge.to) : undefined;
    if (!nxt || seen.has(nxt.id)) break;
    seen.add(nxt.id); plan.path.push(nxt.id);
    const d = nxt.data || {};
    if (isCondition(nxt.type)) {
      const answer = conditionAnswer(nxt, ctx) ? 'yes' : 'no';
      plan.decisions.push({ nodeId: nxt.id, answer });
      port = answer;
    } else {
      port = 'out';
      switch (nxt.type) {
        case 'act_send': plan.actions.push({ kind: 'send', nodeId: nxt.id, text: fillVars(String(d.text ?? ''), ctx).trim() }); plan.handled = true; break;
        case 'act_ai': plan.actions.push({ kind: 'ai', nodeId: nxt.id }); plan.handled = true; break;
        case 'act_assign': plan.actions.push({ kind: 'assign', nodeId: nxt.id, userId: String(d.userId ?? ''), userName: String(d.userName ?? '') }); break;
        case 'act_assign_client_sales': plan.actions.push({ kind: 'assign_client_sales', nodeId: nxt.id }); break;
        case 'act_handover': plan.actions.push({ kind: 'handover', nodeId: nxt.id, reason: String(d.reason ?? '').trim() || 'A flow handed this chat to a person.' }); plan.handled = true; break;
        case 'act_note': plan.actions.push({ kind: 'note', nodeId: nxt.id, text: fillVars(String(d.text ?? ''), ctx).trim() }); break;
      }
    }
    cur = nxt;
  }
  return plan;
}

// ---------------------------------------------------------------- examples
export interface ExampleFlow { name: string; description: string; graph: Graph }
const node = (id: string, type: NodeType, x: number, y: number, data: Record<string, any> = {}): FlowNode => ({ id, type, x, y, data });
const edge = (from: string, port: Port, to: string): FlowEdge => ({ id: `${from}-${port}-${to}`, from, port, to });

/** The four flows suggested to start with. They are created switched off: the team reads them and switches them on. */
export function exampleFlows(): ExampleFlow[] {
  return [
    {
      name: 'Meta Ads lead: greet and ask',
      description: 'A new lead from a Meta Ads ad gets a warm greeting and one question. The AI answers from the second message on.',
      graph: {
        nodes: [
          node('t', 'trigger_new_lead', 40, 120),
          node('c', 'cond_source', 300, 120, { channels: ['meta_ads'] }),
          node('s', 'act_send', 580, 60, { text: 'Hi kak, {bot} disini dari {perusahaan}. Makasih sudah klik iklan kami ya. Boleh tau nama kakak dan toko kakak jualan apa?' }),
          node('a', 'act_ai', 580, 220),
        ],
        edges: [edge('t', 'out', 'c'), edge('c', 'yes', 's'), edge('c', 'no', 'a')],
      },
    },
    {
      name: 'After hours: team replies tomorrow',
      description: 'A new lead who writes when the team is closed is told the team answers in the morning, and the question is kept for them.',
      graph: {
        nodes: [
          node('t', 'trigger_new_lead', 40, 120),
          node('h', 'cond_hours', 300, 120),
          node('a', 'act_ai', 580, 60),
          node('s', 'act_send', 580, 220, { text: 'Hi kak, {bot} disini. Tim kami sudah selesai untuk hari ini dan akan membalas kakak besok pagi ya. Sambil menunggu, boleh cerita toko kakak jualan apa?' }),
        ],
        edges: [edge('t', 'out', 'h'), edge('h', 'yes', 'a'), edge('h', 'no', 's')],
      },
    },
    {
      name: 'Existing client: straight to their salesperson',
      description: 'When a client writes, the chat goes to the salesperson who handles them, with a short answer, and the bot stays out of it.',
      graph: {
        nodes: [
          node('t', 'trigger_new_lead', 40, 120),
          node('c', 'cond_client', 300, 120),
          node('g', 'act_assign_client_sales', 580, 60),
          node('s', 'act_send', 800, 60, { text: 'Hi kak {nama}, pesan kakak sudah kami teruskan ke tim yang biasa menangani kakak ya. Mohon ditunggu sebentar.' }),
          node('h', 'act_handover', 1040, 60, { reason: 'Existing client: handled by their salesperson.' }),
          node('a', 'act_ai', 580, 220),
        ],
        edges: [edge('t', 'out', 'c'), edge('c', 'yes', 'g'), edge('g', 'out', 's'), edge('s', 'out', 'h'), edge('c', 'no', 'a')],
      },
    },
    {
      name: 'Price talk: hand over to a person',
      description: 'When a lead wants to negotiate a price, the bot says a person will follow up and the chat goes to the team.',
      graph: {
        nodes: [
          node('t', 'trigger_keyword', 40, 100, { keywords: 'nego, tawar, diskon, potongan, harga pas, kurangi' }),
          node('s', 'act_send', 320, 100, { text: 'Untuk soal harga, biar tim kami yang bahas langsung dengan kakak ya. {bot} kabari mereka sekarang, mohon ditunggu sebentar ya kak.' }),
          node('n', 'act_note', 600, 100, { text: 'Lead minta nego harga: tolong dihubungi.' }),
          node('h', 'act_handover', 880, 100, { reason: 'The lead wants to negotiate the price.' }),
        ],
        edges: [edge('t', 'out', 's'), edge('s', 'out', 'n'), edge('n', 'out', 'h')],
      },
    },
  ];
}
