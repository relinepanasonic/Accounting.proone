import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- a fake database: rows per table, the candidates the SQL function returns, and every write
const rows: Record<string, any> = {};
const writes: Array<{ table: string; op: string; row: any }> = [];
let candidates: any[] = [];
vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: candidates, error: null }),
    from: (table: string) => {
      let op = 'select';
      const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain, gte: () => chain, order: () => chain, limit: () => chain,
        insert: (r: any) => { op = 'insert'; writes.push({ table, op, row: r }); return chain; },
        update: (r: any) => { op = 'update'; writes.push({ table, op, row: r }); return chain; },
        upsert: (r: any) => { op = 'upsert'; writes.push({ table, op, row: r }); return chain; },
        maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table] ?? null, error: null }),
        then: (res: any, rej?: any) => Promise.resolve({ data: op === 'select' ? (Array.isArray(rows[table]) ? rows[table] : []) : [{ group_id: 'claimed' }], error: null, count: 0 }).then(res, rej),
      };
      return chain;
    },
  }),
}));
const send = vi.fn();
vi.mock('./send-any', () => ({ sendToChat: (...a: unknown[]) => send(...a) }));
const book = vi.fn();
const SLOTS = [new Date('2026-11-16T03:00:00Z'), new Date('2026-11-16T07:00:00Z'), new Date('2026-11-17T03:00:00Z')];
vi.mock('./meetings', () => ({
  availableSlots: vi.fn(async () => SLOTS), meetSettings: vi.fn(async () => ({ minutes: 30 })), upcomingFor: vi.fn(async () => null),
  bookMeeting: (...a: unknown[]) => book(...a),
}));
vi.mock('./broadcasts', () => ({ bcSettings: vi.fn(async () => ({ from: '00:00', to: '23:59' })) }));
import { handleNudgeReply, runNudges } from './nudges';

const written = (t: string, op?: string) => writes.filter((w) => w.table === t && (!op || w.op === op)).map((w) => w.row);

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  writes.length = 0; candidates = [];
  send.mockReset(); send.mockResolvedValue({ ok: true, parts: 1, detail: 'ok' });
  book.mockReset();
  rows.wa_bot_config = { nudge_enabled: true, nudge_hours: '24,72' };
});

describe('the clock sends the due follow-up', () => {
  it('a lead quiet for 25 hours gets the first nudge with three numbered times, once', async () => {
    const now = new Date('2026-11-15T04:00:00Z');
    candidates = [{ workspace_id: 'w1', group_id: 'g1', wa_id: '628111', name: 'Nico', last_in: new Date(now.getTime() - 25 * 3600000).toISOString() }];
    expect(await runNudges(now)).toBe(1);
    expect(written('chat_nudges', 'insert')[0]).toMatchObject({ group_id: 'g1', sent: 1, total: 1, offer: SLOTS.map((d) => d.toISOString()) });
    expect(send.mock.calls[0][2]).toContain('Hi kak Nico');
    expect(send.mock.calls[0][2]).toContain('3. Selasa 17 Nov');
  });

  it('nothing goes out when follow-ups are off, or nothing is due yet', async () => {
    const now = new Date('2026-11-15T04:00:00Z');
    candidates = [{ workspace_id: 'w1', group_id: 'g1', wa_id: '628111', name: 'Nico', last_in: new Date(now.getTime() - 5 * 3600000).toISOString() }];
    expect(await runNudges(now)).toBe(0);
    rows.wa_bot_config = { nudge_enabled: false };
    candidates[0].last_in = new Date(now.getTime() - 25 * 3600000).toISOString();
    expect(await runNudges(now)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('the lead answers a nudge', () => {
  it('a number books that time and sends the time and link', async () => {
    rows.chat_nudges = { offer: SLOTS.map((d) => d.toISOString()), offer_at: new Date().toISOString() };
    book.mockResolvedValue({ ok: true, meeting: { id: 'm1' }, text: 'Jadwal konsultasi gratis kakak dengan tim ahli: Senin 16 Nov, jam 14.00 WIB (30 menit).' });
    expect(await handleNudgeReply('w1', 'g1', '628111', '2')).toBe(true);
    expect(book.mock.calls[0][1]).toMatchObject({ groupId: 'g1', start: SLOTS[1].toISOString(), by: 'bot' });
    expect(send.mock.calls[0][2]).toMatch(/^Siap kak, jadwal konsultasi/);
    expect(written('chat_nudges', 'update')[0]).toMatchObject({ offer: null, booked_at: expect.any(String) });
  });

  it('a taken time gets three new ones; a question goes to the bot', async () => {
    rows.chat_nudges = { offer: SLOTS.map((d) => d.toISOString()), offer_at: new Date().toISOString() };
    book.mockResolvedValue({ ok: false, status: 409, error: 'taken' });
    expect(await handleNudgeReply('w1', 'g1', '628111', '1')).toBe(true);
    expect(send.mock.calls[0][2]).toContain('barusan terisi');
    expect(await handleNudgeReply('w1', 'g1', '628111', 'kak paket juragan berapa?')).toBe(false);
  });

  it('an old offer (over 3 days) is not used', async () => {
    rows.chat_nudges = { offer: SLOTS.map((d) => d.toISOString()), offer_at: new Date(Date.now() - 4 * 86400000).toISOString() };
    expect(await handleNudgeReply('w1', 'g1', '628111', '1')).toBe(false);
    expect(book).not.toHaveBeenCalled();
  });
});
