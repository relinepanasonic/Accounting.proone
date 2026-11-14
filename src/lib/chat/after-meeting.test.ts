import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- a fake database: rows per table, and every write
const rows: Record<string, any> = {};
const writes: Array<{ table: string; op: string; row: any }> = [];
vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let op = 'select';
      const chain: any = {
        select: () => chain, eq: () => chain, neq: () => chain, in: () => chain, not: () => chain, order: () => chain, limit: () => chain,
        insert: (r: any) => { op = 'insert'; writes.push({ table, op, row: r }); return chain; },
        update: (r: any) => { op = 'update'; writes.push({ table, op, row: r }); return chain; },
        upsert: (r: any) => { op = 'upsert'; writes.push({ table, op, row: r }); return chain; },
        maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table] ?? null, error: null }),
        then: (res: any, rej?: any) => Promise.resolve({ data: op === 'select' ? (Array.isArray(rows[table]) ? rows[table] : rows[table] ? [rows[table]] : []) : null, error: null }).then(res, rej),
      };
      return chain;
    },
  }),
}));
const send = vi.fn();
vi.mock('./send-any', () => ({ sendToChat: (...a: unknown[]) => send(...a) }));
const SLOTS = [new Date('2026-11-18T03:00:00Z'), new Date('2026-11-18T07:00:00Z'), new Date('2026-11-19T03:00:00Z')];
vi.mock('./meetings', () => ({ availableSlots: vi.fn(async () => SLOTS), slotLabel: (d: Date) => d.toISOString() }));
const createLead = vi.fn();
vi.mock('./crm-data', () => ({ createLeadFromChat: (...a: unknown[]) => createLead(...a) }));
import { afterMeeting } from './after-meeting';

const MEETING = { id: 'm1', group_id: 'g1', lead_name: 'Nico Japar', store: 'Toko Nico', starts_at: '2026-11-16T02:00:00Z', ends_at: '2026-11-16T03:00:00Z', status: 'done', owner_id: 'u1', owner_name: 'Rani Putri', lead_visit_id: 'v1' };
const written = (t: string, op?: string) => writes.filter((w) => w.table === t && (!op || w.op === op)).map((w) => w.row);

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  writes.length = 0;
  send.mockReset(); send.mockResolvedValue({ ok: true, parts: 1, detail: 'ok' });
  createLead.mockReset(); createLead.mockResolvedValue({ ok: true, dealId: 'd-new', clientId: 'c-new', newClient: true });
  rows.chat_meetings = MEETING;
  rows.wa_groups = { wa_id: '6281234567890', name: 'Nico' };
  rows.wa_bot_config = {};
});

describe('Done', () => {
  it('thanks the lead (naming who sends the next step) and moves the open ERP deal to Negotiation', async () => {
    rows.clients = [{ id: 'c1', phone: '081234567890' }];
    rows.crm_deals = [{ id: 'd1', stage: 'Contacted', client_id: 'c1' }];
    const r = await afterMeeting('w1', 'm1', 'done');
    expect(r).toMatchObject({ message: 'sent', stage: 'Negotiation' });
    expect(send.mock.calls[0][2]).toContain('Hi kak Nico, terima kasih');
    expect(send.mock.calls[0][2]).toContain('dikirim oleh kak Rani');
    expect(written('crm_deals', 'update')[0]).toMatchObject({ stage: 'Negotiation' });
    expect(written('lead_visits', 'update')[0]).toEqual({ deal_id: 'd1', client_id: 'c1' });
    expect(createLead).not.toHaveBeenCalled();
  });

  it('without a deal, a lead is made for the salesperson of the meeting; an invoiced deal is never moved back', async () => {
    await afterMeeting('w1', 'm1', 'done');
    expect(createLead.mock.calls[0][2]).toMatchObject({ salesmanId: 'u1', title: 'Konsultasi gratis (dari chat)' });
    expect(written('crm_deals', 'update')[0]).toMatchObject({ stage: 'Negotiation' });

    writes.length = 0; createLead.mockReset();
    rows.clients = [{ id: 'c1', phone: '6281234567890' }];
    rows.crm_deals = [{ id: 'd1', stage: 'Invoice', client_id: 'c1' }];
    expect(await afterMeeting('w1', 'm1', 'done')).toMatchObject({ stage: 'Invoice' });
    expect(written('crm_deals', 'update')).toHaveLength(0);
  });

  it('the thank-you can be switched off; the ERP lead still moves', async () => {
    rows.wa_bot_config = { after_thanks: false };
    const r = await afterMeeting('w1', 'm1', 'done');
    expect(r.message).toBe('off');
    expect(send).not.toHaveBeenCalled();
    expect(written('crm_deals', 'update')).toHaveLength(1);
  });
});

describe('Did not come', () => {
  it('the lead gets three new times, kept so a number in reply books it', async () => {
    rows.chat_meetings = { ...MEETING, status: 'no_show' };
    const r = await afterMeeting('w1', 'm1', 'no_show');
    expect(r.message).toBe('sent');
    expect(send.mock.calls[0][2]).toContain('belum sempat ketemu di konsultasi jam 09.00 WIB');
    expect(send.mock.calls[0][2]).toContain('(1, 2 atau 3)');
    expect(written('chat_nudges', 'upsert')[0]).toMatchObject({ group_id: 'g1', offer: SLOTS.map((d) => d.toISOString()) });
  });

  it('nothing is sent when switched off, or for a meeting booked by hand without a chat', async () => {
    rows.wa_bot_config = { after_no_show: false };
    expect((await afterMeeting('w1', 'm1', 'no_show')).message).toBe('off');
    rows.chat_meetings = { ...MEETING, group_id: null };
    expect((await afterMeeting('w1', 'm1', 'no_show')).message).toBe('none');
    expect(send).not.toHaveBeenCalled();
  });
});
