/**
 * Scenario flows, the pure parts (no database, no network). A flow is boxes joined by lines, drawn in the dashboard:
 *   a trigger (a new lead's first message, or a keyword) -> conditions (yes / no lines) -> actions (send a message, let the AI answer, give the chat to a person...).
 * This file checks a drawing and works out WHAT WOULD HAPPEN for a message: planFlow() returns the list of actions in order. Doing them (sending, assigning)
 * is the server's job, so this logic is tested without any of that. The same function powers the "Try it" panel, which sends nothing.
 */

export type NodeType =
  | 'trigger_new_lead' | 'trigger_keyword'
  | 'cond_source' | 'cond_keyword' | 'cond_hours' | 'cond_client' | 'cond_answer'
  | 'act_send' | 'act_ask' | 'act_wait' | 'act_ai' | 'act_assign' | 'act_assign_client_sales' | 'act_handover' | 'act_note';

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
  answers?: Record<string, string>;   // what the lead answered to "Ask a question" boxes, by field name
}

export const TRIGGERS: NodeType[] = ['trigger_new_lead', 'trigger_keyword'];
export const CONDITIONS: NodeType[] = ['cond_source', 'cond_keyword', 'cond_hours', 'cond_client', 'cond_answer'];
export const ACTIONS: NodeType[] = ['act_send', 'act_ask', 'act_wait', 'act_ai', 'act_assign', 'act_assign_client_sales', 'act_handover', 'act_note'];
export const isCondition = (t: NodeType) => CONDITIONS.includes(t);
export const isTrigger = (t: NodeType) => TRIGGERS.includes(t);
export const portsOf = (t: NodeType): Port[] => (isCondition(t) ? ['yes', 'no'] : isTrigger(t) || ACTIONS.includes(t) ? ['out'] : []);

export const NODE_LABEL: Record<NodeType, string> = {
  trigger_new_lead: 'New lead writes', trigger_keyword: 'Message has a keyword',
  cond_source: 'Lead came from', cond_keyword: 'Message has a keyword', cond_hours: 'Team is open', cond_client: 'Is already a client', cond_answer: 'Answer has a keyword',
  act_send: 'Send a message', act_ask: 'Ask a question', act_wait: 'Wait', act_ai: 'AI answers', act_assign: 'Give to a salesperson', act_assign_client_sales: "Give to the client's salesperson", act_handover: 'Hand over to a person', act_note: 'Add a team note',
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

/** Where an "Ask a question" box saves the answer: 1-24 of a-z, 0-9 and _, starting with a letter, and not one of the built-in names. */
export const RESERVED_FIELDS = ['nama', 'bot', 'perusahaan'];
export const cleanField = (raw: unknown): string => String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 24);
export const isValidField = (f: string): boolean => /^[a-z][a-z0-9_]{0,23}$/.test(f) && !RESERVED_FIELDS.includes(f);

/**
 * {nama} = the lead's first name (or "kak"), {bot} = the bot's name, {perusahaan} = the company, {any_field} = what the lead answered to an
 * "Ask a question" box. A field not answered (yet) is left out, so a message never shows "{toko}" to a lead.
 */
export function fillVars(text: string, ctx: Pick<FlowContext, 'leadName' | 'persona' | 'company' | 'answers'>): string {
  const first = String(ctx.leadName || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)[0] || 'kak';
  const answers = ctx.answers || {};
  return String(text ?? '').replace(/\{([a-z][a-z0-9_]{0,23})\}/gi, (_all, raw: string) => {
    const f = raw.toLowerCase();
    if (f === 'nama') return first;
    if (f === 'bot') return ctx.persona;
    if (f === 'perusahaan') return ctx.company;
    return Object.prototype.hasOwnProperty.call(answers, f) ? String(answers[f] ?? '') : '';
  }).replace(/[ \t]{2,}/g, ' ');
}

/** The longest a Wait box may pause: 3 days. */
export const MAX_WAIT_MINUTES = 3 * 1440;

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
    if (n.type === 'act_send' || n.type === 'act_note' || n.type === 'act_ask') {
      const t = String(d.text ?? '').trim();
      if (!t) errors.push(`"${label}": write the text.`);
      else if (t.length > MAX_TEXT) errors.push(`"${label}": the text is too long (max ${MAX_TEXT} characters).`);
    }
    if (n.type === 'act_assign' && !d.userId) errors.push(`"${label}": pick the salesperson.`);
    if (n.type === 'act_ask' && !isValidField(cleanField(d.field))) errors.push(`"${label}": name where the answer is saved (letters, numbers and _, like toko or budget; not nama, bot or perusahaan).`);
    if (n.type === 'act_wait') {
      const m = Number(d.minutes);
      if (!Number.isFinite(m) || m < 1 || m > MAX_WAIT_MINUTES) errors.push(`"${label}": the wait must be between 1 minute and 3 days.`);
    }
    if (n.type === 'cond_answer') {
      if (!isValidField(cleanField(d.field))) errors.push(`"${label}": pick which answer to check.`);
      else if (!nodes.some((x) => x.type === 'act_ask' && cleanField(x.data?.field) === cleanField(d.field))) errors.push(`"${label}": no "Ask a question" box saves an answer as "${cleanField(d.field)}".`);
      if (keywordList(d.keywords).length === 0) errors.push(`"${label}": type at least one keyword.`);
    }
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
  // after a Wait there is no new message for the AI to answer
  const afterWait = new Set<string>();
  const q2 = nodes.filter((n) => n.type === 'act_wait').map((n) => n.id);
  while (q2.length) { const id = q2.shift()!; for (const t of next.get(id) || []) if (!afterWait.has(t)) { afterWait.add(t); q2.push(t); } }
  if (nodes.some((n) => n.type === 'act_ai' && afterWait.has(n.id))) errors.push('"AI answers" cannot come after a Wait: there is no new message to answer by then. Use "Send a message" instead.');

  for (const n of nodes) if (!reached.has(n.id)) warnings.push(`"${NODE_LABEL[n.type] || n.type}" is not connected to the trigger, so it never runs.`);
  for (const n of nodes) if (isCondition(n.type)) {
    const ports = edges.filter((e) => e.from === n.id).map((e) => e.port);
    if (!ports.includes('yes') || !ports.includes('no')) warnings.push(`"${NODE_LABEL[n.type]}": only one answer (yes or no) leads anywhere. For the other, the flow stops and the normal bot continues.`);
  }
  if (!nodes.some((n) => n.type === 'act_send' || n.type === 'act_ask' || n.type === 'act_ai' || n.type === 'act_handover')) warnings.push('Nothing in this flow answers the lead, so the normal bot will still reply.');
  return { errors, warnings };
}

// ---------------------------------------------------------------- what would happen
export type PlannedAction =
  | { kind: 'send'; nodeId: string; text: string }
  | { kind: 'ask'; nodeId: string; text: string; field: string }
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
  /** The flow stopped to wait: for the lead's answer (saved as `field`), or for a time. It goes on from `nodeId` later. */
  pause?: { nodeId: string; kind: 'answer'; field: string } | { nodeId: string; kind: 'wait'; minutes: number; ifReply: 'stop' | 'continue' };
}

export function conditionAnswer(n: FlowNode, ctx: FlowContext): boolean {
  const d = n.data || {};
  switch (n.type) {
    case 'cond_source': return (Array.isArray(d.channels) && d.channels.includes(ctx.sourceChannel ?? '')) || (!!d.sourceId && d.sourceId === ctx.sourceId);
    case 'cond_keyword': return hasKeyword(ctx.message, keywordList(d.keywords));
    case 'cond_hours': return ctx.inHours;
    case 'cond_client': return ctx.isClient;
    case 'cond_answer': return hasKeyword(String(ctx.answers?.[cleanField(d.field)] ?? ''), keywordList(d.keywords));
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
  const trigger = (g?.nodes || []).find((n) => isTrigger(n.type));
  if (!trigger || !triggerMatches(trigger, ctx)) return none;
  return walk(g, ctx, trigger.id);
}

/**
 * Goes on with a flow that stopped at `nodeId` (an "Ask a question" box once the answer is in ctx.answers, or a Wait box once the time is up):
 * the same as planFlow, from the line that leaves that box. `matched` is false when the box is gone from the drawing.
 */
export function resumeFlow(g: Graph, ctx: FlowContext, nodeId: string): Plan {
  if (!(g?.nodes || []).some((n) => n.id === nodeId)) return { matched: false, path: [], decisions: [], actions: [], handled: false };
  return walk(g, ctx, nodeId);
}

function walk(g: Graph, ctx: FlowContext, fromId: string): Plan {
  const nodes = g?.nodes || []; const edges = g?.edges || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const plan: Plan = { matched: true, path: [fromId], decisions: [], actions: [], handled: false };
  const seen = new Set<string>([fromId]);
  let cur: FlowNode | undefined = byId.get(fromId);
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
        case 'act_ask': {
          const field = cleanField(d.field);
          plan.actions.push({ kind: 'ask', nodeId: nxt.id, text: fillVars(String(d.text ?? ''), ctx).trim(), field });
          plan.handled = true;
          plan.pause = { nodeId: nxt.id, kind: 'answer', field };
          return plan;
        }
        case 'act_wait': {
          plan.handled = true;   // the flow has this chat while it waits: the normal bot does not also answer
          plan.pause = { nodeId: nxt.id, kind: 'wait', minutes: Math.min(MAX_WAIT_MINUTES, Math.max(1, Math.round(Number(d.minutes) || 1))), ifReply: d.ifReply === 'continue' ? 'continue' : 'stop' };
          return plan;
        }
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

/**
 * What a lead's new message does to a flow of theirs that is stopped. Waiting for an answer: this message IS the answer. A Wait box set to
 * "stop if they reply" (a nudge for a quiet lead): the reply ends the flow. A Wait set to "carry on anyway": the flow keeps waiting.
 */
export type PausedMessage = 'answer' | 'stop_flow' | 'keep_waiting';
export function onMessageWhilePaused(pause: { kind: 'answer' | 'wait'; ifReply?: string | null }): PausedMessage {
  if (pause.kind === 'answer') return 'answer';
  return pause.ifReply === 'continue' ? 'keep_waiting' : 'stop_flow';
}

/** An answer is kept short and on one line. */
export const cleanAnswer = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);

/** A stopped flow waiting for an answer gives up after a day: the lead has moved on, and the normal bot takes the next message. */
export const ANSWER_EXPIRES_MINUTES = 1440;

// ---------------------------------------------------------------- examples
export interface ExampleFlow { name: string; description: string; graph: Graph }
const node = (id: string, type: NodeType, x: number, y: number, data: Record<string, any> = {}): FlowNode => ({ id, type, x, y, data });
const edge = (from: string, port: Port, to: string): FlowEdge => ({ id: `${from}-${port}-${to}`, from, port, to });

/** The flows suggested to start with. They are created switched off: the team reads them and switches them on. */
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
      name: 'Ask what the shop sells',
      description: 'A new lead is asked what their shop sells. The answer is saved as "toko" and used in the next message, which depends on whether it is a fashion shop.',
      graph: {
        nodes: [
          node('t', 'trigger_new_lead', 40, 140),
          node('q', 'act_ask', 300, 140, { text: 'Hi kak, {bot} disini dari {perusahaan}. Boleh tau toko kakak jualan apa?', field: 'toko' }),
          node('c', 'cond_answer', 560, 140, { field: 'toko', keywords: 'fashion, baju, hijab, kaos, sepatu, gamis' }),
          node('s1', 'act_send', 820, 60, { text: 'Wah, kategori fashion lagi ramai banget kak! Kami sudah bantu banyak toko fashion. Omzet per bulan sekarang kira-kira berapa kak?' }),
          node('s2', 'act_send', 820, 220, { text: 'Siap kak, untuk toko {toko} kami punya paket yang cocok. Omzet per bulan sekarang kira-kira berapa kak?' }),
        ],
        edges: [edge('t', 'out', 'q'), edge('q', 'out', 'c'), edge('c', 'yes', 's1'), edge('c', 'no', 's2')],
      },
    },
    {
      name: 'Quiet lead: one nudge after an hour',
      description: 'A new lead gets a greeting. If they have not replied an hour later, they get one friendly nudge. Any reply from them ends this flow.',
      graph: {
        nodes: [
          node('t', 'trigger_new_lead', 40, 120),
          node('s', 'act_send', 300, 120, { text: 'Hi kak, {bot} disini dari {perusahaan}. Apa ada yang bisa di bantu kak?' }),
          node('w', 'act_wait', 560, 120, { minutes: 60, ifReply: 'stop' }),
          node('n', 'act_send', 820, 120, { text: 'Kak {nama}, {bot} masih disini ya kalau ada yang mau ditanyakan. Mau {bot} kirimkan info paketnya kak?' }),
        ],
        edges: [edge('t', 'out', 's'), edge('s', 'out', 'w'), edge('w', 'out', 'n')],
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
