import { describe, it, expect } from 'vitest';
import { cleanAnswer, cleanField, exampleFlows, fillVars, hasKeyword, keywordList, onMessageWhilePaused, planFlow, resumeFlow, validateGraph, type FlowContext, type Graph } from './flow';

const ctx = (over: Partial<FlowContext> = {}): FlowContext => ({ message: 'Halo kak mau tanya paket', isFirst: true, sourceChannel: null, sourceId: null, inHours: true, isClient: false, leadName: 'Budi Santoso', persona: 'Fefe', company: 'Prof Toko Online', ...over });
const [META, AFTER, CLIENT, ASK, NUDGE, PRICE] = exampleFlows().map((f) => f.graph);

describe('keywords and variables', () => {
  it('keywords are split on commas, semicolons and lines, and cleaned', () => {
    expect(keywordList('Nego, Tawar;  harga pas\n Diskon ,,')).toEqual(['nego', 'tawar', 'harga pas', 'diskon']);
  });
  it('a keyword is a whole word or phrase, not a part of another word', () => {
    expect(hasKeyword('Bisa nego ga kak?', ['nego'])).toBe(true);
    expect(hasKeyword('ini harga pas atau bisa kurang', ['harga pas'])).toBe(true);
    expect(hasKeyword('Saya tertarik negosiasi', ['nego'])).toBe(false);
    expect(hasKeyword('', ['nego'])).toBe(false);
  });
  it('fills the lead\'s first name, the bot and the company; "kak" when there is no name', () => {
    expect(fillVars('Hi {nama}, {bot} dari {perusahaan}', ctx())).toBe('Hi Budi, Fefe dari Prof Toko Online');
    expect(fillVars('Hi kak {nama}', ctx({ leadName: '' }))).toBe('Hi kak kak');
    expect(fillVars('Hi {NAMA}', ctx({ leadName: '😀 Sari' }))).toBe('Hi Sari');
  });
});

describe('the example flows', () => {
  it('are all valid drawings', () => {
    for (const f of exampleFlows()) expect(validateGraph(f.graph).errors, f.name).toEqual([]);
    expect(exampleFlows()).toHaveLength(6);
  });
});

describe('planFlow: Meta Ads greeting', () => {
  it('a new lead from Meta Ads gets the greeting, with the bot and company filled in', () => {
    const p = planFlow(META, ctx({ sourceChannel: 'meta_ads' }));
    expect(p.matched).toBe(true);
    expect(p.handled).toBe(true);
    expect(p.actions).toEqual([{ kind: 'send', nodeId: 's', text: expect.stringContaining('Hi kak, Fefe disini dari Prof Toko Online') }]);
    expect(p.decisions).toEqual([{ nodeId: 'c', answer: 'yes' }]);
    expect(p.path).toEqual(['t', 'c', 's']);
  });
  it('a lead from anywhere else goes to the AI instead', () => {
    const p = planFlow(META, ctx({ sourceChannel: 'google_ads' }));
    expect(p.actions.map((a) => a.kind)).toEqual(['ai']);
    expect(p.decisions[0].answer).toBe('no');
  });
  it('does not run for a later message of the chat (only the first message starts a "new lead" flow)', () => {
    expect(planFlow(META, ctx({ isFirst: false, sourceChannel: 'meta_ads' }))).toMatchObject({ matched: false, actions: [], handled: false });
  });
});

describe('planFlow: after hours and clients and price talk', () => {
  it('inside team hours the AI answers; outside, the "tomorrow morning" message goes out', () => {
    expect(planFlow(AFTER, ctx({ inHours: true })).actions.map((a) => a.kind)).toEqual(['ai']);
    const out = planFlow(AFTER, ctx({ inHours: false }));
    expect(out.actions).toEqual([{ kind: 'send', nodeId: 's', text: expect.stringContaining('membalas kakak besok pagi') }]);
  });
  it('an existing client is given to their salesperson, gets a message, and is handed over; a stranger goes to the AI', () => {
    const p = planFlow(CLIENT, ctx({ isClient: true }));
    expect(p.actions.map((a) => a.kind)).toEqual(['assign_client_sales', 'send', 'handover']);
    expect(p.actions[1]).toMatchObject({ text: expect.stringContaining('Hi kak Budi') });
    expect(p.handled).toBe(true);
    expect(planFlow(CLIENT, ctx({ isClient: false })).actions.map((a) => a.kind)).toEqual(['ai']);
  });
  it('a keyword flow runs on any message with the keyword: message, note, hand over', () => {
    const p = planFlow(PRICE, ctx({ isFirst: false, message: 'Bisa nego harganya kak?' }));
    expect(p.actions.map((a) => a.kind)).toEqual(['send', 'note', 'handover']);
    expect(planFlow(PRICE, ctx({ message: 'Mau tanya paket' })).matched).toBe(false);
  });
  it('a flow that only gives the chat to someone does not answer, so the normal bot still replies', () => {
    const g: Graph = { nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 'a', type: 'act_assign', x: 0, y: 0, data: { userId: 'u1', userName: 'Rani' } }], edges: [{ id: 'e', from: 't', port: 'out', to: 'a' }] };
    const p = planFlow(g, ctx());
    expect(p.matched).toBe(true);
    expect(p.actions).toEqual([{ kind: 'assign', nodeId: 'a', userId: 'u1', userName: 'Rani' }]);
    expect(p.handled).toBe(false);
  });
});

describe('planFlow: safety', () => {
  it('stops at a box that is not connected, and never loops', () => {
    const loop: Graph = {
      nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 'a', type: 'act_note', x: 0, y: 0, data: { text: 'x' } }, { id: 'b', type: 'act_note', x: 0, y: 0, data: { text: 'y' } }],
      edges: [{ id: '1', from: 't', port: 'out', to: 'a' }, { id: '2', from: 'a', port: 'out', to: 'b' }, { id: '3', from: 'b', port: 'out', to: 'a' }],
    };
    expect(planFlow(loop, ctx()).actions).toHaveLength(2);
    expect(planFlow({ nodes: [], edges: [] }, ctx()).matched).toBe(false);
  });
});

describe('validateGraph', () => {
  const t = { id: 't', type: 'trigger_new_lead' as const, x: 0, y: 0, data: {} };
  it('an empty drawing, no trigger, or two triggers are refused', () => {
    expect(validateGraph({ nodes: [], edges: [] }).errors[0]).toMatch(/empty/);
    expect(validateGraph({ nodes: [{ id: 'a', type: 'act_ai', x: 0, y: 0, data: {} }], edges: [] }).errors.join()).toMatch(/needs a trigger/);
    expect(validateGraph({ nodes: [t, { ...t, id: 't2' }], edges: [] }).errors.join()).toMatch(/only one trigger/);
  });
  it('boxes with missing settings say what to fill in', () => {
    const g: Graph = { nodes: [t, { id: 'k', type: 'cond_keyword', x: 0, y: 0, data: { keywords: ' , ' } }, { id: 's', type: 'act_send', x: 0, y: 0, data: { text: '  ' } }, { id: 'c', type: 'cond_source', x: 0, y: 0, data: {} }, { id: 'a', type: 'act_assign', x: 0, y: 0, data: {} }], edges: [] };
    const e = validateGraph(g).errors.join(' | ');
    expect(e).toMatch(/at least one keyword/);
    expect(e).toMatch(/write the text/);
    expect(e).toMatch(/channel or ad/);
    expect(e).toMatch(/pick the salesperson/);
  });
  it('lines to nothing, from a place a box does not have, two lines from one point, back into the trigger, and loops are refused', () => {
    const a = { id: 'a', type: 'act_note' as const, x: 0, y: 0, data: { text: 'x' } };
    const b = { id: 'b', type: 'act_note' as const, x: 0, y: 0, data: { text: 'y' } };
    expect(validateGraph({ nodes: [t, a], edges: [{ id: '1', from: 't', port: 'out', to: 'zzz' }] }).errors.join()).toMatch(/does not exist/);
    expect(validateGraph({ nodes: [t, a], edges: [{ id: '1', from: 't', port: 'yes', to: 'a' }] }).errors.join()).toMatch(/place it does not have/);
    expect(validateGraph({ nodes: [t, a, b], edges: [{ id: '1', from: 't', port: 'out', to: 'a' }, { id: '2', from: 't', port: 'out', to: 'b' }] }).errors.join()).toMatch(/two lines/);
    expect(validateGraph({ nodes: [t, a], edges: [{ id: '1', from: 't', port: 'out', to: 'a' }, { id: '2', from: 'a', port: 'out', to: 't' }] }).errors.join()).toMatch(/back into the trigger/);
    expect(validateGraph({ nodes: [t, a, b], edges: [{ id: '1', from: 't', port: 'out', to: 'a' }, { id: '2', from: 'a', port: 'out', to: 'b' }, { id: '3', from: 'b', port: 'out', to: 'a' }] }).errors.join()).toMatch(/loop/);
  });
  it('warns, but allows, a box nobody reaches, a one-sided condition, and a flow that never answers', () => {
    const a = { id: 'a', type: 'act_note' as const, x: 0, y: 0, data: { text: 'x' } };
    const c = { id: 'c', type: 'cond_hours' as const, x: 0, y: 0, data: {} };
    const r = validateGraph({ nodes: [t, c, a], edges: [{ id: '1', from: 't', port: 'out', to: 'c' }, { id: '2', from: 'c', port: 'yes', to: 'a' }] });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(' | ')).toMatch(/only one answer/);
    expect(r.warnings.join(' | ')).toMatch(/normal bot will still reply/);
    expect(validateGraph({ nodes: [t, a], edges: [] }).warnings.join()).toMatch(/not connected/);
  });
});

describe('answers as variables', () => {
  it('{field} is what the lead answered; a field not answered yet is left out, never shown as {toko}', () => {
    expect(fillVars('Toko {toko} ya, {nama}', ctx({ answers: { toko: 'hijab' } }))).toBe('Toko hijab ya, Budi');
    expect(fillVars('Untuk toko {toko} kami ada paket', ctx())).toBe('Untuk toko kami ada paket');
  });
  it('field names are cleaned to a-z, 0-9 and _', () => {
    expect(cleanField(' Budget Iklan ')).toBe('budget_iklan');
    expect(cleanField('toko-online!')).toBe('toko_online');
  });
  it('an answer is kept to one short line', () => {
    expect(cleanAnswer('  jual\n\nhijab   dan gamis ')).toBe('jual hijab dan gamis');
    expect(cleanAnswer('x'.repeat(500))).toHaveLength(300);
  });
});

describe('Ask a question', () => {
  it('sends the question and stops, waiting for the answer to save as "toko"', () => {
    const p = planFlow(ASK, ctx());
    expect(p.actions).toEqual([{ kind: 'ask', nodeId: 'q', field: 'toko', text: expect.stringContaining('Boleh tau toko kakak jualan apa?') }]);
    expect(p.pause).toEqual({ nodeId: 'q', kind: 'answer', field: 'toko' });
    expect(p.handled).toBe(true);
  });
  it('with the answer in, it goes on from the question and can branch on the answer', () => {
    const fashion = resumeFlow(ASK, ctx({ isFirst: false, answers: { toko: 'Baju anak dan hijab' } }), 'q');
    expect(fashion.decisions).toEqual([{ nodeId: 'c', answer: 'yes' }]);
    expect(fashion.actions).toEqual([{ kind: 'send', nodeId: 's1', text: expect.stringContaining('fashion') }]);
    const other = resumeFlow(ASK, ctx({ isFirst: false, answers: { toko: 'elektronik' } }), 'q');
    expect(other.actions).toEqual([{ kind: 'send', nodeId: 's2', text: expect.stringContaining('untuk toko elektronik') }]);
    expect(other.pause).toBeUndefined();
  });
  it('a box removed from the drawing since then: nothing happens', () => {
    expect(resumeFlow(ASK, ctx(), 'gone')).toMatchObject({ matched: false, actions: [] });
  });
  it('the question needs a text and a valid name for the answer', () => {
    const g: Graph = { nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 'q', type: 'act_ask', x: 0, y: 0, data: { text: '', field: 'nama' } }], edges: [{ id: 'e', from: 't', port: 'out', to: 'q' }] };
    const errs = validateGraph(g).errors.join(' | ');
    expect(errs).toContain('write the text');
    expect(errs).toContain('name where the answer is saved');
  });
  it('"Answer has a keyword" must check an answer some question saves', () => {
    const g: Graph = { nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 'c', type: 'cond_answer', x: 0, y: 0, data: { field: 'budget', keywords: 'besar' } }], edges: [{ id: 'e', from: 't', port: 'out', to: 'c' }] };
    expect(validateGraph(g).errors.join(' ')).toContain('no "Ask a question" box saves an answer as "budget"');
  });
});

describe('Wait', () => {
  it('stops for the time set; the greeting goes out first', () => {
    const p = planFlow(NUDGE, ctx());
    expect(p.actions.map((a) => a.kind)).toEqual(['send']);
    expect(p.pause).toEqual({ nodeId: 'w', kind: 'wait', minutes: 60, ifReply: 'stop' });
  });
  it('when the time is up, the nudge is sent', () => {
    const p = resumeFlow(NUDGE, ctx({ isFirst: false, message: '' }), 'w');
    expect(p.actions).toEqual([{ kind: 'send', nodeId: 'n', text: expect.stringContaining('Kak Budi, Fefe masih disini') }]);
  });
  it('a reply while waiting: the answer to a question, the end of a "no reply" nudge, or nothing for "carry on anyway"', () => {
    expect(onMessageWhilePaused({ kind: 'answer' })).toBe('answer');
    expect(onMessageWhilePaused({ kind: 'wait', ifReply: 'stop' })).toBe('stop_flow');
    expect(onMessageWhilePaused({ kind: 'wait', ifReply: 'continue' })).toBe('keep_waiting');
  });
  it('the wait is between 1 minute and 3 days, and the AI cannot answer after a wait (there is no new message)', () => {
    const base = (minutes: number, after: 'act_ai' | 'act_send'): Graph => ({
      nodes: [{ id: 't', type: 'trigger_new_lead', x: 0, y: 0, data: {} }, { id: 'w', type: 'act_wait', x: 0, y: 0, data: { minutes } }, { id: 'a', type: after, x: 0, y: 0, data: { text: 'hi' } }],
      edges: [{ id: 'e1', from: 't', port: 'out', to: 'w' }, { id: 'e2', from: 'w', port: 'out', to: 'a' }],
    });
    expect(validateGraph(base(0, 'act_send')).errors.join(' ')).toContain('between 1 minute and 3 days');
    expect(validateGraph(base(5000, 'act_send')).errors.join(' ')).toContain('between 1 minute and 3 days');
    expect(validateGraph(base(30, 'act_send')).errors).toEqual([]);
    expect(validateGraph(base(30, 'act_ai')).errors.join(' ')).toContain('cannot come after a Wait');
  });
});
