import { describe, it, expect, vi, beforeEach } from 'vitest';

// a fake database: one settings row, no bookings, no Google link
const rows: Record<string, any> = {};
vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, neq: () => chain, gte: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
        maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table] ?? null }),
        then: (res: any) => res({ data: Array.isArray(rows[table]) ? rows[table] : rows[table] ? [rows[table]] : [], error: null }),
      };
      return chain;
    },
  }),
}));
vi.mock('./send-any', () => ({ sendToChat: vi.fn() }));
vi.mock('@/lib/google/calendar', () => ({ accessToken: vi.fn(), authUrl: vi.fn(), busyTimes: vi.fn(), createMeetEvent: vi.fn(), deleteEvent: vi.fn(), exchangeCode: vi.fn(), googleConfigured: () => false, makeState: vi.fn() }));
import { availableSlots, meetingContext } from './meetings';

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  rows.wa_bot_config = { meet_enabled: false, meet_days: '0,1,2,3,4,5,6', meet_from: '09:00', meet_to: '18:00', meet_minutes: 60, meet_notice_hours: 0, meet_days_ahead: 7 };
});

describe('the Jadwal switch is about the bot only', () => {
  it('switched off: the team still has free times to book from the inbox', async () => {
    expect((await availableSlots('w1', true)).length).toBeGreaterThan(0);
  });
  it('switched off: the bot is not told to invite anyone', async () => {
    expect(await meetingContext('w1', 'g1')).toMatchObject({ enabled: false, offer: [] });
  });
  it('switched on: the bot gets the free times to offer', async () => {
    rows.wa_bot_config = { ...rows.wa_bot_config, meet_enabled: true };
    const c = await meetingContext('w1', 'g1');
    expect(c.enabled).toBe(true);
    expect(c.offer.length).toBeGreaterThan(0);
  });
});
