import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- a fake database: rows per table, counts per table, and a record of every write
const rows: Record<string, any> = {};
const counts: Record<string, number> = {};
const writes: Array<{ table: string; op: string; row: any }> = [];

vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let op = 'select'; let payload: any = null; let selected = false;
      const chain: any = {
        select: () => { selected = true; return chain; }, eq: () => chain, neq: () => chain, in: () => chain, lte: () => chain, gte: () => chain, lt: () => chain, is: () => chain, order: () => chain, limit: () => chain,
        insert: (r: any) => { op = 'insert'; payload = r; writes.push({ table, op, row: r }); return chain; },
        update: (r: any) => { op = 'update'; payload = r; writes.push({ table, op, row: r }); return chain; },
        upsert: (r: any) => { op = 'upsert'; payload = r; writes.push({ table, op, row: r }); return chain; },
        delete: () => { op = 'delete'; writes.push({ table, op, row: null }); return chain; },
        single: async () => ({ data: op === 'insert' ? { id: 'new1' } : first(table), error: null }),
        maybeSingle: async () => ({ data: first(table), error: null }),
        then: (res: any) => res({ data: op === 'update' && selected ? [{ id: 'claimed' }] : list(table), count: counts[table] ?? 0, error: null }),
      };
      void payload;
      return chain;
    },
  }),
}));
const first = (t: string) => (Array.isArray(rows[t]) ? rows[t][0] ?? null : rows[t] ?? null);
const list = (t: string) => (Array.isArray(rows[t]) ? rows[t] : rows[t] ? [rows[t]] : []);

const send = vi.fn();
vi.mock('@/lib/wa/send', () => ({ sendWhatsApp: (...a: unknown[]) => send(...a) }));
vi.mock('./send-any', () => ({ sendToChat: vi.fn(async () => ({ ok: true, parts: 1, detail: 'ok' })) }));
import { runBroadcasts } from './broadcasts';

const BC = { id: 'b1', workspace_id: 'w1', message: 'Halo kak {nama}, ada info baru.', fails_in_row: 0 };
const at = (wib: string) => new Date(`2026-11-16T${wib}:00+07:00`);           // a Monday, Jakarta time
const written = (t: string, op?: string) => writes.filter((w) => w.table === t && (!op || w.op === op)).map((w) => w.row);

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  for (const k of Object.keys(counts)) delete counts[k];
  writes.length = 0;
  send.mockReset(); send.mockResolvedValue({ ok: true, parts: 1, detail: 'ok' });
  rows.chat_broadcasts = [BC];
  rows.wa_bot_config = { bc_daily_max: 40, bc_from: '09:00', bc_to: '19:00', bc_gap_min: 90, bc_gap_max: 240 };
  rows.chat_broadcast_recipients = { id: 'r1', wa_id: '628111', name: 'Budi Santoso', position: 0, group_id: 'g1' };
  counts.chat_broadcast_recipients = 3;            // sent today so far
  process.env.FONNTE_TOKEN_SALES = 'tok';
});

describe('runBroadcasts', () => {
  it('inside the window and under the daily maximum: sends ONE message, with the name and the STOP line, saves it in the chat, and waits a random gap', async () => {
    expect(await runBroadcasts(at('10:00'))).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual(['628111']);
    expect(send.mock.calls[0][1]).toContain('Halo kak Budi, ada info baru.');
    expect(send.mock.calls[0][1]).toContain('Balas STOP');
    expect(written('chat_broadcast_recipients', 'update')).toEqual(expect.arrayContaining([{ status: 'sending' }, expect.objectContaining({ status: 'sent' })]));
    expect(written('wa_messages', 'insert')[0]).toMatchObject({ group_id: 'g1', is_from_me: true, source: 'broadcast' });
    const next = written('chat_broadcasts', 'update').find((r) => r.next_send_at);
    const gap = new Date(next.next_send_at).getTime() - at('10:00').getTime();
    expect(gap).toBeGreaterThanOrEqual(90000);
    expect(gap).toBeLessThanOrEqual(240000);
  });

  it('outside the window: nothing is sent, it waits for the next opening', async () => {
    expect(await runBroadcasts(at('20:30'))).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(written('chat_broadcasts', 'update')[0].next_send_at).toBe(new Date('2026-11-17T09:00:00+07:00').toISOString());
  });

  it('the daily maximum reached: nothing is sent until tomorrow\'s opening', async () => {
    counts.chat_broadcast_recipients = 40;
    expect(await runBroadcasts(at('11:00'))).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(written('chat_broadcasts', 'update')[0].next_send_at).toBe(new Date('2026-11-17T09:00:00+07:00').toISOString());
  });

  it('someone who said STOP since is skipped, not sent', async () => {
    rows.chat_optouts = { wa_id: '628111' };
    expect(await runBroadcasts(at('10:00'))).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(written('chat_broadcast_recipients', 'update')).toContainEqual({ status: 'skipped', error: 'Said STOP' });
  });

  it('the third failure in a row pauses the broadcast with the reason', async () => {
    rows.chat_broadcasts = [{ ...BC, fails_in_row: 2 }];
    send.mockResolvedValue({ ok: false, parts: 0, detail: 'device disconnected' });
    expect(await runBroadcasts(at('10:00'))).toBe(0);
    expect(written('chat_broadcasts', 'update')).toContainEqual(expect.objectContaining({ status: 'paused', fails_in_row: 3, paused_reason: expect.stringContaining('device disconnected') }));
  });

  it('nobody left in the queue: the broadcast is done', async () => {
    rows.chat_broadcast_recipients = null;
    expect(await runBroadcasts(at('10:00'))).toBe(0);
    expect(written('chat_broadcasts', 'update')).toContainEqual(expect.objectContaining({ status: 'done' }));
  });
});
