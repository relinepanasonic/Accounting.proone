import { describe, it, expect } from 'vitest';
import { planRebuild, describePlan } from './rebuild';

// Kulkas Puan: bought 06 Jan 2026 for 1.311.000, 12 months (109.250 a month), 10 months posted by 26 Oct 2026.
const existing = () => new Map(Array.from({ length: 10 }, (_, i) => [`2026-${String(i + 1).padStart(2, '0')}`, 109250] as [string, number]));

describe('rebuilding the schedule after the months change', () => {
  it('12 -> 6 months: Jan-Jun change to 218.500, Jul-Oct leave the ledger, book value ends at 0', () => {
    const plan = planRebuild({ purchase: '2026-01-06', months: 6, cost: 1311000, salvage: 0, today: '2026-10-26', existing: existing() });
    expect(plan.lines).toHaveLength(6);
    expect(plan.lines.every((l) => l.action === 'update' && l.amount === 218500)).toBe(true);
    expect(plan.removed.map((r) => r.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(plan.before).toBe(1092500);
    expect(plan.after).toBe(1311000);
    expect(plan.changes).toBe(true);
    expect(describePlan(plan)).toContain('+Rp 218.500');
  });

  it('nothing changes when the months stay the same', () => {
    const plan = planRebuild({ purchase: '2026-01-06', months: 12, cost: 1311000, salvage: 0, today: '2026-10-26', existing: existing() });
    expect(plan.lines.slice(0, 10).every((l) => l.action === 'keep')).toBe(true);
    expect(plan.lines.slice(10).every((l) => l.action === 'future')).toBe(true);
    expect(plan.changes).toBe(false);
  });

  it('12 -> 24 months: the posted months drop to half and the rest is still to come', () => {
    const plan = planRebuild({ purchase: '2026-01-06', months: 24, cost: 1311000, salvage: 0, today: '2026-10-26', existing: existing() });
    expect(plan.lines).toHaveLength(24);
    expect(plan.lines.slice(0, 10).every((l) => l.action === 'update' && l.amount === 54625)).toBe(true);
    expect(plan.lines.slice(10).every((l) => l.action === 'future')).toBe(true);
    expect(plan.after).toBe(546250);
  });

  it('a due month without a ledger line is added', () => {
    const e = existing(); e.delete('2026-04');
    const plan = planRebuild({ purchase: '2026-01-06', months: 12, cost: 1311000, salvage: 0, today: '2026-10-26', existing: e });
    expect(plan.lines.find((l) => l.month === '2026-04')?.action).toBe('insert');
  });
});
