import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- a fake database: rows per table, and every write
const rows: Record<string, any> = {};
const writes: Array<{ table: string; op: string; row: any }> = [];
let inbound = 3;
vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let op = 'select'; let head = false;
      const chain: any = {
        select: (_c?: string, o?: any) => { head = !!o?.head; return chain; }, eq: () => chain, neq: () => chain, in: () => chain, not: () => chain, gt: () => chain, lte: () => chain, gte: () => chain, order: () => chain, limit: () => chain,
        insert: (r: any) => { op = 'insert'; writes.push({ table, op, row: r }); return chain; },
        update: (r: any) => { op = 'update'; writes.push({ table, op, row: r }); return chain; },
        upsert: (r: any) => { op = 'upsert'; writes.push({ table, op, row: r }); return chain; },
        maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table] ?? null, error: null }),
        then: (res: any, rej?: any) => Promise.resolve(head && table === 'wa_messages' ? { count: inbound, data: null, error: null } : { data: op === 'select' ? (Array.isArray(rows[table]) ? rows[table] : rows[table] ? [rows[table]] : []) : null, error: null }).then(res, rej),
      };
      return chain;
    },
  }),
}));
const createLead = vi.fn();
vi.mock('./crm-data', () => ({ createLeadFromChat: (...a: unknown[]) => createLead(...a) }));
import { autoStage } from './pipeline';
import { cleanOwners, DEFAULT_WORDS, hasWord, nextOwner, parseWords, stageFor, wordsOf } from './stage-rules';

const written = (t: string, op?: string) => writes.filter((w) => w.table === t && (!op || w.op === op)).map((w) => w.row);
const facts = { hasName: false, hasStore: false, replied: false, text: '', offeredTimes: false, deckSent: false };

describe('the stage a chat shows (rules)', () => {
  it('actions: first message, a reply, name and store, free times sent, the deck', () => {
    expect(stageFor(facts, DEFAULT_WORDS).stage).toBe('Lead');
    expect(stageFor({ ...facts, replied: true }, DEFAULT_WORDS).stage).toBe('Contacted');
    expect(stageFor({ ...facts, replied: true, hasName: true, hasStore: true }, DEFAULT_WORDS).stage).toBe('Qualified');
    expect(stageFor({ ...facts, deckSent: true }, DEFAULT_WORDS).stage).toBe('Warm');
    expect(stageFor({ ...facts, hasName: true, hasStore: true, offeredTimes: true }, DEFAULT_WORDS).stage).toBe('Meeting Offered');
  });
  it('trigger words: price is Warm, "mau daftar" is Negotiation, "tidak jadi" is Lost; the highest wins', () => {
    expect(stageFor({ ...facts, text: 'kak paket juragan berapa harganya?' }, DEFAULT_WORDS).stage).toBe('Warm');
    expect(stageFor({ ...facts, text: 'oke saya mau daftar kak' }, DEFAULT_WORDS).stage).toBe('Negotiation');
    expect(stageFor({ ...facts, text: 'maaf kak tidak jadi dulu ya' }, DEFAULT_WORDS).stage).toBe('Cold Case');
    expect(stageFor({ ...facts, offeredTimes: true, text: 'berapa biayanya?' }, DEFAULT_WORDS).stage).toBe('Meeting Offered');
  });
  it('words match whole words only, and the lists are editable', () => {
    expect(hasWord('Harga-nya berapa?', ['harga'])).toBe(true);
    expect(hasWord('hargai saya', ['harga'])).toBe(false);
    expect(parseWords('Harga, paket ; PROMO\n harga')).toEqual(['harga', 'paket', 'promo']);
    expect(wordsOf({ warm: 'info, katalog' }).warm).toEqual(['info', 'katalog']);
    expect(wordsOf({ warm: 'info' }).lost).toEqual(DEFAULT_WORDS.lost);        // a group never edited keeps its defaults
    expect(wordsOf(null)).toEqual(DEFAULT_WORDS);
  });
});

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  writes.length = 0; inbound = 3;
  createLead.mockReset(); createLead.mockResolvedValue({ ok: true, dealId: 'd-new', clientId: 'c-new', newClient: true });
  rows.wa_bot_config = { stage_auto: true, meet_owner_id: '11111111-1111-1111-1111-111111111111', meet_owner_name: 'Rani Putri' };
  rows.chat_state = {};
  rows.wa_bot_chats = { lead: { name: 'Nico', store: 'Toko Nico' } };
  rows.wa_groups = { name: 'Nico' };
});

describe('autoStage', () => {
  it('does nothing while the switch is off', async () => {
    rows.wa_bot_config = { stage_auto: false };
    expect(await autoStage('w1', 'g1', '628111', { text: 'berapa harganya' })).toBeNull();
    expect(createLead).not.toHaveBeenCalled();
  });

  it('makes the lead for the Jadwal salesperson once the name or store is known, and moves it to Qualified', async () => {
    const r = await autoStage('w1', 'g1', '628111000001', { text: 'halo' });
    expect(createLead.mock.calls[0][2]).toMatchObject({ salesmanId: '11111111-1111-1111-1111-111111111111', store: 'Toko Nico' });
    expect(r).toBe('Qualified');
    expect(written('crm_deals', 'update')[0]).toMatchObject({ stage: 'Qualified' });
    expect(written('chat_notes', 'insert').map((n) => n.body).join(' ')).toContain('lead baru dibuat');
  });

  it('no name, no store: no lead', async () => {
    rows.wa_bot_chats = { lead: {} }; rows.wa_groups = { name: '+62 811 1000 001' };
    expect(await autoStage('w1', 'g1', '628111', { text: 'halo' })).toBeNull();
    expect(createLead).not.toHaveBeenCalled();
  });

  it('a name but nobody to own it: the lead is still made, without an owner, and the team note says so', async () => {
    rows.wa_bot_chats = { lead: { name: 'Nico' } }; rows.wa_bot_config = { stage_auto: true };
    expect(await autoStage('w1', 'g1', '628111', { text: 'halo' })).toBe('Contacted');   // made, then moved on: the lead has written 3 times
    expect(createLead.mock.calls[0][3]).toBeNull();                              // no owner
    expect(written('chat_notes', 'insert').map((n) => n.body).join(' ')).toContain('belum ada sales');
  });

  it('a deal already further along is never moved back', async () => {
    rows.chat_state = { deal_id: 'd1' };
    rows.clients = []; rows.crm_deals = { id: 'd1', stage: 'Meeting Booked', client_id: 'c1' };
    expect(await autoStage('w1', 'g1', 'ig:123', { text: 'berapa harganya' })).toBe('Meeting Booked');
    expect(written('crm_deals', 'update')).toHaveLength(0);
  });

  it('a lead who said "tidak jadi" before the meeting goes to Cold Leads, with a note', async () => {
    rows.chat_state = { deal_id: 'd1' };
    rows.crm_deals = { id: 'd1', stage: 'Warm', client_id: 'c1' };
    expect(await autoStage('w1', 'g1', 'ig:123', { text: 'tidak jadi ya kak' })).toBe('Cold Case');
    expect(written('chat_notes', 'insert').pop().body).toContain('Warm ke Cold Leads');
  });
});

const HERLAN = { id: 'f7125e06-59f9-4d8d-8114-b54c47388454', name: 'Herlan' };
const VELLY = { id: '0a1b2c3d-1111-4222-8333-444455556666', name: 'Velly' };

describe('sharing new leads in turn', () => {
  it('the person with the fewest new leads in 30 days gets the next one; a tie goes to the one higher in the list', () => {
    expect(nextOwner([HERLAN, VELLY], {})).toEqual(HERLAN);
    expect(nextOwner([HERLAN, VELLY], { [HERLAN.id]: 1 })).toEqual(VELLY);
    expect(nextOwner([HERLAN, VELLY], { [HERLAN.id]: 3, [VELLY.id]: 3 })).toEqual(HERLAN);
    expect(nextOwner([HERLAN, VELLY], { [HERLAN.id]: 2, [VELLY.id]: 1 })).toEqual(VELLY);
    expect(nextOwner([], {})).toBeNull();
  });
  it('the saved list keeps real ids only, each once, with a name', () => {
    expect(cleanOwners([HERLAN, HERLAN, { id: 'not-an-id', name: 'X' }, { id: VELLY.id }, null])).toEqual([HERLAN, { id: VELLY.id, name: 'Sales' }]);
    expect(cleanOwners('nope')).toEqual([]);
  });
  it('autoStage gives the new lead to the next person in the list, and the chat to them too', async () => {
    rows.wa_bot_config = { stage_auto: true, lead_owners: [HERLAN, VELLY] };
    rows.crm_deals = [{ salesman_id: HERLAN.id }];                      // Herlan already got one: Velly is next
    await autoStage('w1', 'g1', '628111000001', { text: 'halo' });
    expect(createLead.mock.calls[0][2]).toMatchObject({ salesmanId: VELLY.id });
    expect(createLead.mock.calls[0][3]).toMatchObject({ userId: VELLY.id, name: 'Velly' });
    expect(written('chat_state', 'upsert').some((r) => r.assigned_to === VELLY.id)).toBe(true);
    expect(written('chat_notes', 'insert').map((n) => n.body).join(' ')).toContain('untuk Velly');
  });
  it('a chat that already has a salesperson keeps them; the rotation is not used', async () => {
    rows.wa_bot_config = { stage_auto: true, lead_owners: [HERLAN, VELLY] };
    rows.chat_state = { assigned_to: HERLAN.id, assigned_name: 'Herlan' };
    rows.crm_deals = [{ salesman_id: HERLAN.id }, { salesman_id: HERLAN.id }];
    await autoStage('w1', 'g1', '628111000001', { text: 'halo' });
    expect(createLead.mock.calls[0][3]).toMatchObject({ userId: HERLAN.id });
  });
});
