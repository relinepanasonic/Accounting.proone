import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/api/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/api/erp-report', () => ({ loadErpDashboards: async () => ({}) }));

import { planReport } from './whatsapp-report';

describe('planReport', () => {
  it('Tuesday to Saturday: daily report of yesterday', () => {
    expect(planReport('2026-10-21')).toMatchObject({ kind: 'daily', from: '2026-10-20', to: '2026-10-20' }); // Wednesday
    expect(planReport('2026-10-24')).toMatchObject({ kind: 'daily', from: '2026-10-23', to: '2026-10-23' }); // Saturday sends Friday
  });
  it('Sunday sends nothing', () => {
    expect(planReport('2026-10-25').kind).toBe('none');
  });
  it('Monday: month to date until yesterday (Sunday)', () => {
    expect(planReport('2026-10-26')).toMatchObject({ kind: 'weekly', from: '2026-10-01', to: '2026-10-25' });
  });
  it('first Monday of a new month: the month that ended, in full', () => {
    expect(planReport('2026-11-02')).toMatchObject({ kind: 'monthly', from: '2026-10-01', to: '2026-10-31' });
    expect(planReport('2027-01-04')).toMatchObject({ kind: 'monthly', from: '2026-12-01', to: '2026-12-31' });
  });
});
