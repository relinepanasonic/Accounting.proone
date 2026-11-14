import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/api/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/api/erp-report', () => ({ loadErpDashboards: async () => ({}) }));

import { currentSlot, planReport } from './whatsapp-report';

describe('planReport', () => {
  it('evening, Monday to Friday: the daily report of that same day, compared with the work day before', () => {
    expect(planReport('2026-10-21', 'evening')).toMatchObject({ kind: 'daily', from: '2026-10-21', to: '2026-10-21', prevFrom: '2026-10-20' }); // Wednesday
    expect(planReport('2026-10-26', 'evening')).toMatchObject({ kind: 'daily', from: '2026-10-26', prevFrom: '2026-10-23' });                 // Monday vs Friday
    expect(planReport('2026-10-21')).toMatchObject({ kind: 'daily', from: '2026-10-21' });                                                    // evening is the default
  });
  it('Saturday and Sunday evenings send nothing', () => {
    expect(planReport('2026-10-24', 'evening').kind).toBe('none');
    expect(planReport('2026-10-25', 'evening').kind).toBe('none');
  });
  it('Monday morning: month to date until yesterday (Sunday); other mornings nothing', () => {
    expect(planReport('2026-10-26', 'morning')).toMatchObject({ kind: 'weekly', from: '2026-10-01', to: '2026-10-25' });
    expect(planReport('2026-10-27', 'morning').kind).toBe('none');
  });
  it('first Monday morning of a new month: the month that ended, in full', () => {
    expect(planReport('2026-11-02', 'morning')).toMatchObject({ kind: 'monthly', from: '2026-10-01', to: '2026-10-31' });
    expect(planReport('2027-01-04', 'morning')).toMatchObject({ kind: 'monthly', from: '2026-12-01', to: '2026-12-31' });
  });
  it('the slot when none is named: before 14:00 Jakarta morning, after it evening', () => {
    expect(currentSlot(new Date('2026-11-16T01:00:00Z'))).toBe('morning');   // 08:00 WIB
    expect(currentSlot(new Date('2026-11-16T12:00:00Z'))).toBe('evening');   // 19:00 WIB
  });
});
