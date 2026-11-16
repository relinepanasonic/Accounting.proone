import { describe, it, expect } from 'vitest';
import { canArchive, isLastDayOfMonth } from './junk-leads';

describe('which leads may be archived as junk', () => {
  it('a lead that never got past an offered meeting', () => {
    for (const stage of ['Lead', 'Contacted', 'Qualified', 'Warm', 'Meeting Offered']) expect(canArchive({ stage })).toBe(true);
  });
  it('never a lead that booked a meeting or went further', () => {
    for (const stage of ['Meeting Booked', 'Meeting Done', 'Negotiation', 'Invoice Requested', 'Invoice', 'Deal', 'Cold Case']) expect(canArchive({ stage })).toBe(false);
  });
  it('never one with an invoice or a payment', () => {
    expect(canArchive({ stage: 'Lead', invoice_id: 'x' })).toBe(false);
    expect(canArchive({ stage: 'Lead', paid_at: '2026-11-01' })).toBe(false);
  });
});

describe('the month-end day (Jakarta time)', () => {
  it('is the last day of the month', () => {
    expect(isLastDayOfMonth(new Date('2026-11-30T16:30:00Z'))).toBe(true);   // 23:30 WIB on 30 Nov
    expect(isLastDayOfMonth(new Date('2026-12-31T16:30:00Z'))).toBe(true);
    expect(isLastDayOfMonth(new Date('2028-02-29T16:30:00Z'))).toBe(true);   // leap year
  });
  it('is not any other day', () => {
    expect(isLastDayOfMonth(new Date('2026-11-16T16:30:00Z'))).toBe(false);
    expect(isLastDayOfMonth(new Date('2026-11-29T16:30:00Z'))).toBe(false);
    expect(isLastDayOfMonth(new Date('2027-02-27T16:30:00Z'))).toBe(false);
  });
});
