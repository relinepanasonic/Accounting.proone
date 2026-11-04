import { describe, it, expect } from 'vitest';
import { calendarFromReports } from './input-series';
import { mondaysOf, shortModal, oneDecimal } from '@/components/productivity/StoreCalendarChart';

describe('calendarFromReports', () => {
  it('orders GMV Max, groups, then mandiri and keeps modal and target per session', () => {
    const cal = calendarFromReports([
      { client_id: 'c', report_date: '2026-10-26', session: 1, data_inkubasi: [{ modalHarian: '25000', targetRoas: '14' }], data_group: [{ groupName: 'Group B', modalHarian: '30000', targetRoas: '16,2' }, { groupName: 'Group A', modalHarian: '10000', targetRoas: '8' }], data_mandiri: [{ infoIklan: 'Mandiri B', modalHarian: '5000', targetRoas: '5' }, { infoIklan: 'Mandiri A', modalHarian: '6000', targetRoas: '6' }] },
    ]);
    expect(cal.ads).toEqual(['GMV Max', 'Group A', 'Group B', 'Mandiri A', 'Mandiri B']);
    expect(cal.cells['2026-10-26']['1']['Group B']).toEqual([30000, 16.2]);
  });
});

describe('week and number helpers', () => {
  it('a week belongs to the month of its Monday', () => {
    expect(mondaysOf(2026, 10)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    expect(mondaysOf(2026, 11)).toContain('2026-11-02');
  });
  it('short numbers', () => {
    expect(shortModal(25000)).toBe('25k');
    expect(shortModal(27500)).toBe('28k');
    expect(shortModal(109100)).toBe('109k');
    expect(oneDecimal(14)).toBe('14,0');
    expect(oneDecimal(16.24)).toBe('16,2');
  });
});
