import { describe, it, expect } from 'vitest';
import { addMonths, buildSchedule, spread, monthsOf } from './schedule';

describe('asset schedule', () => {
  it('12 mio over 12 months from 24 Oct 2026: 1 mio on the 24th of each month', () => {
    const s = buildSchedule('2026-10-24', 12, 12_000_000, 0);
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({ seq: 1, due_date: '2026-10-24', amount: 1_000_000 });
    expect(s[1].due_date).toBe('2026-11-24');
    expect(s[2].due_date).toBe('2026-12-24');
    expect(s[3].due_date).toBe('2027-01-24');
    expect(s[11].due_date).toBe('2027-09-24');
    expect(s.reduce((a, l) => a + l.amount, 0)).toBe(12_000_000);
  });

  it('a 31st becomes the last day of a short month, and the total never drifts', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    const s = buildSchedule('2026-01-31', 7, 10_000_000, 1_000_000);
    expect(s.reduce((a, l) => Math.round((a + l.amount) * 100) / 100, 0)).toBe(9_000_000);
  });

  it('the salvage value stays out of the schedule; months can be fractional years', () => {
    expect(buildSchedule('2026-10-24', 10, 5_000_000, 5_000_000)).toEqual([]);
    expect(monthsOf(1.5)).toBe(18);
    expect(monthsOf(null)).toBe(12);
  });

  it('the rest of a schedule can be re-spread after an edit', () => {
    const rest = spread('2026-10-24', 9_000_000, 9, 4);
    expect(rest[0]).toEqual({ seq: 4, due_date: '2027-01-24', amount: 1_000_000 });
    expect(rest[8].seq).toBe(12);
  });
});
