import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exampleFlows, type Graph } from './flow';

// ---- a fake database: rows per table, and a record of everything written
const rows: Record<string, any> = {};
const counts: Record<string, number> = {};
const inserts: Array<{ table: string; row: any }> = [];
const upserts: Array<{ table: string; row: any }> = [];
const deletes: string[] = [];

vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, gte: () => chain, in: () => chain, lt: () => chain, lte: () => chain,
        delete: () => { deletes.push(table); return chain; },
        insert: (row: any) => { inserts.push({ table, row }); return chain; },
        upsert: (row: any) => { upserts.push({ table, row }); return chain; },
        update: () => chain,
        single: async () => ({ data: { id: 'new1' }, error: null }),
        maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table] ?? null }),
        then: (res: any) => res({ data: Array.isArray(rows[table]) ? rows[table] : rows[table] ? [rows[table]] : [], count: counts[table] ?? 0, error: null }),
      };
      return chain;
    },
  }),
}));
const send = vi.fn();
vi.mock('@/lib/wa/send', () => ({ sendWhatsApp: (...a: unknown[]) => send(...a) }));
const bot = vi.fn();
vi.mock('@/lib/wa/bot/run', () => ({ runSalesBot: (...a: unknown[]) => bot(...a) }));
const record = vi.fn();
vi.mock('@/lib/wa/bot/store', () => ({ recordBotMessage: (...a: unknown[]) => record(...a) }));
const findClient = vi.fn();
vi.mock('./data', () => ({ findClientByPhone: (...a: unknown[]) => findClient(...a), listAgents: async () => [{ id: 'u-rani', name: 'Rani Putri', role: 'sales' }] }));
vi.mock('@/lib/wa/bot/decide', () => ({ inOpenHours: () => true }));
import { cleanGraph, runDueWaits, runFlowsFor, saveFlow, setFlowActive, testFlow } from './flows';

const DEVICE = { id: 'd1', workspace_id: 'w1', phone: '6285758789999', role: 'sales' };
const MSG: any = { device: '6285758789999', chatId: '628111', isGroup: false, groupName: 'Budi', senderPhone: '628111', senderName: 'Budi', body: 'Halo kak mau tanya paket', mediaType: null, mediaUrl: null, mediaFilename: null, externalId: null, isFromMe: false, dedupeKey: 'k', sentAt: new Date() };
const [META, , CLIENT, ASK, NUDGE, PRICE] = exampleFlows().map((f) => f.graph);
const setFlows = (...g: Graph[]) => { rows.bot_flows = g.map((graph, i) => ({ id: `f${i + 1}`, name: `Flow ${i + 1}`, graph })); };
const run = async (m = MSG) => { const p = runFlowsFor(DEVICE, m, 'g1'); await vi.runAllTimersAsync(); return p; };
const writes = (t: string) => [...inserts, ...upserts].filter((w) => w.table === t).map((w) => w.row);

beforeEach(() => {
  vi.useFakeTimers();
  for (const k of Object.keys(rows)) delete rows[k];
  for (const k of Object.keys(counts)) delete counts[k];
  inserts.length = 0; upserts.length = 0; deletes.length = 0;
  send.mockReset(); send.mockResolvedValue({ ok: true, parts: 1, detail: 'ok' });
  bot.mockReset(); bot.mockResolvedValue({ done: 'replied' });
  record.mockReset(); findClient.mockReset(); findClient.mockResolvedValue(null);
  rows.wa_bot_config = { enabled: true, persona_name: 'Fefe', company_name: 'Prof Toko Online', hours_from: '08:00', hours_to: '21:00' };
  rows.wa_bot_chats = { status: 'bot' };
  rows.chat_state = { source_channel: 'meta_ads', source_id: 'm1' };
  rows.wa_groups = { name: 'Budi Santoso' };
  counts.wa_messages = 1;                  // the lead's first message
  process.env.FONNTE_TOKEN_SALES = 'tok';
});
afterEach(() => vi.useRealTimers());

describe('runFlowsFor', () => {
  it('a new Meta Ads lead gets the greeting: sent from the sales number, saved in the chat, logged, and the normal bot stays quiet', async () => {
    setFlows(META);
    const r = await run();
    expect(r).toEqual({ handled: true, flow: 'Flow 1' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual(['628111']);
    expect(send.mock.calls[0][1]).toContain('Hi kak, Fefe disini dari Prof Toko Online');
    expect(send.mock.calls[0][2]).toEqual({ token: 'tok' });
    expect(record).toHaveBeenCalledWith('w1', 'g1', '6285758789999', expect.stringContaining('Fefe disini'), 'flow');
    expect(writes('wa_bot_log')[0]).toMatchObject({ reply: expect.stringContaining('Fefe disini'), detail: 'Flow: Flow 1' });
    expect(writes('bot_flow_runs')[0]).toMatchObject({ flow_name: 'Flow 1', handled: true, outcome: 'ok', actions: ['send'] });
    expect(bot).not.toHaveBeenCalled();
  });

  it('does nothing when the bot\'s master switch is OFF, or a person already has the chat', async () => {
    setFlows(META);
    rows.wa_bot_config = { ...rows.wa_bot_config, enabled: false };
    expect(await run()).toEqual({ handled: false });
    rows.wa_bot_config = { ...rows.wa_bot_config, enabled: true };
    rows.wa_bot_chats = { status: 'human' };
    expect(await run()).toEqual({ handled: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('never runs for a group, for our own message, or on a number that is not the sales number', async () => {
    setFlows(META);
    expect(await run({ ...MSG, isGroup: true })).toEqual({ handled: false });
    expect(await run({ ...MSG, isFromMe: true })).toEqual({ handled: false });
    expect(await runFlowsFor({ ...DEVICE, role: 'admin' }, MSG, 'g1')).toEqual({ handled: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('a switched-off flow does not run (only active flows are read), and with no flows the normal bot goes on', async () => {
    rows.bot_flows = [];
    expect(await run()).toEqual({ handled: false });
  });

  it('a flow that does not answer the lead (it only gives the chat to someone) lets the normal bot reply', async () => {
    setFlows({ nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 'a', type: 'act_assign', x: 0, y: 0, data: { userId: 'u-rani', userName: 'Rani' } }], edges: [{ id: 'e', from: 't', port: 'out', to: 'a' }] });
    expect(await run()).toEqual({ handled: false, flow: 'Flow 1' });
    expect(writes('chat_state')[0]).toMatchObject({ group_id: 'g1', assigned_to: 'u-rani', assigned_name: 'Rani' });
    expect(send).not.toHaveBeenCalled();
  });

  it('when sending fails the run is logged as failed, the flow does not count as an answer, and nothing is saved as sent', async () => {
    setFlows(META);
    send.mockResolvedValue({ ok: false, parts: 0, detail: 'token invalid' });
    const r = await run();
    expect(r.handled).toBe(false);
    expect(record).not.toHaveBeenCalled();
    expect(writes('bot_flow_runs')[0]).toMatchObject({ outcome: 'failed', handled: false });
    expect(writes('bot_flow_runs')[0].detail).toMatch(/token invalid/);
  });

  it('an existing client is given to their salesperson (matched by first name) and handed over', async () => {
    setFlows(CLIENT);
    findClient.mockResolvedValue({ id: 'k1', name: 'Toko A', sales_name: 'Rani' });
    const r = await run();
    expect(r.handled).toBe(true);
    expect(writes('chat_state')[0]).toMatchObject({ assigned_to: 'u-rani', assigned_name: 'Rani Putri' });
    expect(writes('wa_bot_chats').some((x) => x.status === 'human')).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a keyword flow answers a chat only once', async () => {
    setFlows(PRICE);
    counts.wa_messages = 3;
    expect((await run({ ...MSG, body: 'Bisa nego ga kak?' })).handled).toBe(true);
    send.mockClear();
    counts.bot_flow_runs = 1;                      // it already ran for this chat
    expect(await run({ ...MSG, body: 'nego lagi dong' })).toEqual({ handled: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('a broken drawing never runs, and only the first matching flow runs', async () => {
    setFlows({ nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 's', type: 'act_send', x: 0, y: 0, data: { text: '' } }], edges: [{ id: 'e', from: 't', port: 'out', to: 's' }] }, META, META);
    const r = await run();
    expect(r.flow).toBe('Flow 2');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('the AI box lets the normal bot machinery answer, and counts as an answer only when it replied', async () => {
    setFlows({ nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 'a', type: 'act_ai', x: 0, y: 0, data: {} }], edges: [{ id: 'e', from: 't', port: 'out', to: 'a' }] });
    expect((await run()).handled).toBe(true);
    bot.mockResolvedValue({ done: 'bot-off' });
    expect((await run()).handled).toBe(false);
  });
});

describe('saveFlow / setFlowActive', () => {
  it('needs a name; a drawing with problems can be saved switched OFF but not ON', async () => {
    const bad = { nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 's', type: 'act_send', x: 0, y: 0, data: { text: '' } }], edges: [{ id: 'e', from: 't', port: 'out', to: 's' }] };
    const by = { userId: 'u1', name: 'Nico' };
    expect(await saveFlow('w1', { name: ' ', graph: bad }, by)).toMatchObject({ ok: false, status: 400 });
    expect(await saveFlow('w1', { name: 'WIP', graph: bad, active: true }, by)).toMatchObject({ ok: false, error: expect.stringMatching(/Fix this before switching/) });
    const draft: any = await saveFlow('w1', { name: 'WIP', graph: bad, active: false }, by);
    expect(draft.ok).toBe(true);
    expect(draft.warnings.join(' ')).toMatch(/Not ready/);
    expect(writes('bot_flows').at(-1)).toMatchObject({ name: 'WIP', active: false, created_by: 'Nico' });
  });

  it('a good drawing can be saved switched on, and a flow with problems cannot be switched on later', async () => {
    const by = { userId: 'u1', name: 'Nico' };
    expect(await saveFlow('w1', { name: 'Meta', graph: META, active: true }, by)).toMatchObject({ ok: true, id: 'new1' });
    rows.bot_flows = [{ id: 'f9', name: 'x', graph: { nodes: [], edges: [] } }];
    expect(await setFlowActive('w1', 'f9', true, by)).toMatchObject({ ok: false, status: 400 });
    expect(await setFlowActive('w1', 'f9', false, by)).toEqual({ ok: true });
  });
});

describe('cleanGraph and testFlow', () => {
  it('keeps only a typed drawing with numeric positions, whatever the browser sent', () => {
    const g = cleanGraph({ nodes: [{ id: 'a', type: 'act_note', x: '12.6', y: 'oops', data: { text: 'x' }, evil: 1 }, null], edges: [{ id: 'e', from: 'a', port: 'out', to: 'b', extra: true }], junk: 1 });
    expect(g.nodes[0]).toEqual({ id: 'a', type: 'act_note', x: 13, y: 0, data: { text: 'x' } });
    expect(g.edges[0]).toEqual({ id: 'e', from: 'a', port: 'out', to: 'b' });
    expect(cleanGraph(null)).toEqual({ nodes: [], edges: [] });
  });
  it('"Try it" returns the plan without sending anything', () => {
    const r = testFlow(META, { message: 'Halo', sourceChannel: 'meta_ads' });
    expect(r.plan.actions.map((a) => a.kind)).toEqual(['send']);
    expect(r.validation.errors).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('questions and waits', () => {
  it('"Ask a question": the question goes out and the chat remembers the flow is waiting for the answer', async () => {
    setFlows(ASK);
    expect(await run()).toEqual({ handled: true, flow: 'Flow 1' });
    expect(send.mock.calls[0][1]).toContain('Boleh tau toko kakak jualan apa?');
    expect(writes('bot_flow_sessions')[0]).toMatchObject({ group_id: 'g1', flow_id: 'f1', node_id: 'q', kind: 'answer', field: 'toko', expires_at: expect.any(String) });
    expect(writes('bot_flow_runs')[0]).toMatchObject({ actions: ['ask'], detail: expect.stringContaining('waiting for the answer (toko)') });
  });

  it('the next message is the answer: saved on the chat, and the flow goes on with it (the normal bot stays quiet)', async () => {
    setFlows(ASK);
    rows.bot_flow_sessions = { group_id: 'g1', flow_id: 'f1', flow_name: 'Flow 1', node_id: 'q', kind: 'answer', field: 'toko', expires_at: new Date(Date.now() + 3600000).toISOString() };
    counts.wa_messages = 2;
    const r = await run({ ...MSG, body: 'Jual  hijab dan gamis' });
    expect(r).toEqual({ handled: true, flow: 'Flow 1' });
    expect(writes('chat_state')[0]).toMatchObject({ answers: { toko: 'Jual hijab dan gamis' } });
    expect(send.mock.calls[0][1]).toContain('fashion');
    expect(deletes).toContain('bot_flow_sessions');          // ran to its end: nothing left waiting
    expect(writes('bot_flow_runs')[0]).toMatchObject({ actions: ['answer', 'send'] });
  });

  it('a question nobody answered for a day is dropped, and the message is handled as usual', async () => {
    setFlows(ASK);
    rows.bot_flow_sessions = { group_id: 'g1', flow_id: 'f1', flow_name: 'Flow 1', node_id: 'q', kind: 'answer', field: 'toko', expires_at: new Date(Date.now() - 60000).toISOString() };
    counts.wa_messages = 5;
    expect(await run()).toEqual({ handled: false });
    expect(deletes).toContain('bot_flow_sessions');
    expect(writes('chat_state')).toEqual([]);
  });

  it('a reply during a "no reply" Wait ends the flow, and the normal bot answers', async () => {
    setFlows(NUDGE);
    rows.bot_flow_sessions = { group_id: 'g1', flow_id: 'f1', flow_name: 'Flow 1', node_id: 'w', kind: 'wait', if_reply: 'stop', resume_at: new Date(Date.now() + 3600000).toISOString() };
    counts.wa_messages = 2;
    expect(await run()).toEqual({ handled: false });
    expect(deletes).toContain('bot_flow_sessions');
    expect(writes('bot_flow_runs')[0]).toMatchObject({ detail: 'stopped: the lead replied during the wait' });
    expect(send).not.toHaveBeenCalled();
  });

  it('a person taking the chat ends a waiting flow', async () => {
    setFlows(NUDGE);
    rows.wa_bot_chats = { status: 'human' };
    rows.bot_flow_sessions = { group_id: 'g1', flow_id: 'f1', flow_name: 'Flow 1', node_id: 'w', kind: 'wait', if_reply: 'stop' };
    expect(await run()).toEqual({ handled: false });
    expect(deletes).toContain('bot_flow_sessions');
  });

  it('the clock: refuses without the database key; with it, a due Wait sends the nudge to the lead', async () => {
    rows.flow_tick_key = { key: 'k'.repeat(64) };
    expect(await runDueWaits(null)).toMatchObject({ ok: false, status: 401 });
    expect(await runDueWaits('x'.repeat(64))).toMatchObject({ ok: false, status: 401 });

    rows.bot_flow_sessions = [{ group_id: 'g1', workspace_id: 'w1', flow_id: 'f1', flow_name: 'Flow 1', node_id: 'w', kind: 'wait', if_reply: 'stop', resume_at: new Date(Date.now() - 1000).toISOString() }];
    rows.bot_flows = { id: 'f1', name: 'Flow 1', graph: NUDGE, active: true };
    rows.wa_groups = { name: 'Budi Santoso', wa_id: '628111', wa_devices: { id: 'd1', workspace_id: 'w1', phone: '6285758789999', role: 'sales' } };
    const p = runDueWaits('k'.repeat(64)); await vi.runAllTimersAsync();
    expect(await p).toEqual({ ok: true, resumed: 1 });
    expect(send.mock.calls[0][0]).toEqual(['628111']);
    expect(send.mock.calls[0][1]).toContain('Kak Budi, Fefe masih disini');
    expect(writes('bot_flow_runs')[0]).toMatchObject({ trigger_text: '(wait over)', actions: ['send'] });
  });

  it('"Try it" can go on after a question, with a sample answer', () => {
    const first = testFlow(ASK, {});
    expect(first.plan.pause).toMatchObject({ kind: 'answer', field: 'toko' });
    const next = testFlow(ASK, { resumeFrom: 'q', answers: { toko: 'sepatu' } } as any);
    expect(next.plan.actions[0]).toMatchObject({ kind: 'send', text: expect.stringContaining('fashion') });
  });
});
