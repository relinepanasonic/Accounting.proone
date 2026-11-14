import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- a fake database: rows per table, and a record of every write
const rows: Record<string, any> = {};
const writes: Array<{ table: string; op: string; row: any }> = [];
vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let op = 'select'; let selected = false;
      const chain: any = {
        select: () => { selected = true; return chain; }, eq: () => chain, neq: () => chain, in: () => chain, gte: () => chain, lte: () => chain, gt: () => chain, lt: () => chain, is: () => chain, order: () => chain, limit: () => chain,
        insert: (r: any) => { op = 'insert'; writes.push({ table, op, row: r }); return chain; },
        update: (r: any) => { op = 'update'; writes.push({ table, op, row: r }); return chain; },
        upsert: (r: any) => { op = 'upsert'; writes.push({ table, op, row: r }); return chain; },
        delete: () => { op = 'delete'; writes.push({ table, op, row: null }); return chain; },
        single: async () => ({ data: op === 'insert' ? { id: 'new1' } : op === 'update' ? { ...first(table), ...writes.filter((w) => w.table === table && w.op === 'update').at(-1)?.row } : first(table), error: null }),
        maybeSingle: async () => ({ data: first(table), error: null }),
        then: (res: any) => res({ data: op === 'update' && selected ? [{ id: 'claimed' }] : list(table), error: null }),
      };
      return chain;
    },
  }),
}));
const first = (t: string) => (Array.isArray(rows[t]) ? rows[t][0] ?? null : rows[t] ?? null);
const list = (t: string) => (Array.isArray(rows[t]) ? rows[t] : rows[t] ? [rows[t]] : []);
const send = vi.fn();
vi.mock('./send-any', () => ({ sendToChat: (...a: unknown[]) => send(...a) }));
const patch = vi.fn();
vi.mock('@/lib/google/calendar', () => ({ accessToken: vi.fn(async () => 'tok'), authUrl: vi.fn(), busyTimes: vi.fn(async () => []), createMeetEvent: vi.fn(), deleteEvent: vi.fn(), exchangeCode: vi.fn(), googleConfigured: () => true, makeState: vi.fn(), patchEventTime: (...a: unknown[]) => patch(...a) }));
import { handleMeetingReply, runMeetingMessages } from './meetings';

const inHours = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
const MEETING = { id: 'm1', group_id: 'g1', lead_name: 'Nico Japar', store: null, starts_at: inHours(0.9), ends_at: inHours(1.9), status: 'booked', meet_url: 'https://meet.google.com/abc', booked_by: 'bot', created_at: inHours(-24), google_event_id: 'ev1', owner_id: 'u1', owner_name: 'Rani', lead_visit_id: 'v1', confirm_sent_at: inHours(-0.05), confirmed_at: null, reschedule_offer: null, reschedule_asked_at: null, workspace_id: 'w1', wa_groups: { wa_id: '628111' } };
const written = (t: string, op?: string) => writes.filter((w) => w.table === t && (!op || w.op === op)).map((w) => w.row);

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  writes.length = 0;
  send.mockReset(); send.mockResolvedValue({ ok: true, parts: 1, detail: 'ok' });
  patch.mockReset();
  rows.chat_meetings = [MEETING];
  rows.wa_bot_config = { meet_enabled: true, meet_days: '0,1,2,3,4,5,6', meet_from: '00:00', meet_to: '23:30', meet_minutes: 60, meet_notice_hours: 0, meet_days_ahead: 7 };
  rows.google_calendar_link = { email: 'x', refresh_token: 'r', calendar_id: 'primary' };
});

describe('the lead replies about the meeting', () => {
  it('YA after the confirmation: marked confirmed, thanked, the team gets a note; the bot does not also answer', async () => {
    expect(await handleMeetingReply('w1', 'g1', '628111', 'iya kak')).toBe(true);
    expect(written('chat_meetings', 'update')[0]).toEqual({ confirmed_at: expect.any(String) });
    expect(send.mock.calls[0][2]).toContain('terima kasih konfirmasinya');
    expect(written('chat_notes', 'insert')[0].body).toContain('mengonfirmasi hadir');
  });

  it('GANTI: 3 other free times are offered, numbered, and remembered', async () => {
    expect(await handleMeetingReply('w1', 'g1', '628111', 'maaf ga bisa, ganti ya')).toBe(true);
    const offer = written('chat_meetings', 'update').find((r) => r.reschedule_offer);
    expect(offer.reschedule_offer).toHaveLength(3);
    expect(send.mock.calls[0][2]).toMatch(/1\. .*\n2\. .*\n3\. /);
    expect(send.mock.calls[0][2]).toContain('Balas angkanya');
  });

  it('a number after the offer moves the meeting: Google Calendar (same Meet), the ERP meeting, and the confirmation starts over', async () => {
    const tomorrow = new Date(Date.now() + 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    const target = new Date(`${tomorrow}T10:00:00+07:00`).toISOString();   // tomorrow 10:00 WIB: always a free start time in these settings
    rows.chat_meetings = [{ ...MEETING, reschedule_offer: [target], reschedule_asked_at: inHours(-0.1) }];
    expect(await handleMeetingReply('w1', 'g1', '628111', '1')).toBe(true);
    expect(written('chat_meetings', 'update')).toContainEqual(expect.objectContaining({ starts_at: target, confirm_sent_at: null, reminded_at: null }));
    expect(patch).toHaveBeenCalledWith('tok', 'primary', 'ev1', new Date(target), expect.any(Date));
    expect(written('lead_visits', 'update')[0]).toMatchObject({ visit_at: target, salesman_id: 'u1' });
    expect(send.mock.calls[0][2]).toContain('Link Google Meet tetap sama');
  });

  it('BATAL cancels: the ERP meeting is removed and the lead is told', async () => {
    expect(await handleMeetingReply('w1', 'g1', '628111', 'batal kak')).toBe(true);
    expect(written('chat_meetings', 'update')).toContainEqual({ status: 'cancelled' });
    expect(writes.some((w) => w.table === 'lead_visits' && w.op === 'delete')).toBe(true);
    expect(send.mock.calls[0][2]).toContain('kami batalkan');
  });

  it('a normal question is left to the bot, and nothing happens without a booking', async () => {
    expect(await handleMeetingReply('w1', 'g1', '628111', 'kak harga paket juragan berapa ya sebulan?')).toBe(false);
    rows.chat_meetings = [];
    expect(await handleMeetingReply('w1', 'g1', '628111', 'ya')).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('before the meeting', () => {
  it('an hour before: the confirmation; 15 minutes before: the link (each once)', async () => {
    rows.chat_meetings = [{ ...MEETING, confirm_sent_at: null, reminded_at: null, starts_at: inHours(0.2) }];
    expect(await runMeetingMessages()).toBe(2);
    expect(send.mock.calls[0][2]).toContain('Balas YA untuk konfirmasi, atau GANTI');
    expect(send.mock.calls[1][2]).toContain('15 menit lagi kita mulai');
    expect(send.mock.calls[1][2]).toContain('https://meet.google.com/abc');
  });
  it('a meeting booked less than 70 minutes ahead only gets the reminder', async () => {
    rows.chat_meetings = [{ ...MEETING, confirm_sent_at: null, reminded_at: null, starts_at: inHours(0.2), created_at: inHours(-0.5) }];
    await runMeetingMessages();
    expect(send.mock.calls.map((c) => c[2]).some((t: string) => t.includes('Balas YA'))).toBe(false);
  });
});
