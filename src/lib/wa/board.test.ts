import { describe, it, expect } from 'vitest';
import { cellOf, monthWeeks, parseSessionRef, sessionCells, sessionRef, shiftMonth, validMonth, weekDates } from './board';

describe('monthWeeks', () => {
  it('November 2026 has Mondays on 2, 9, 16, 23 and 30: five weeks, each Monday to Sunday', () => {
    const w = monthWeeks('2026-11');
    expect(w.map((x) => x.from)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(w.map((x) => x.label)).toEqual(['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']);
    expect(w[0].to).toBe('2026-11-08');
    expect(w[4].to).toBe('2026-12-06');
  });
  it('a month that starts on a Monday starts Week 1 on the 1st', () => {
    expect(monthWeeks('2026-06')[0].from).toBe('2026-06-01');
  });
  it('a month that starts on a Sunday starts Week 1 the next day', () => {
    expect(monthWeeks('2026-03')[0].from).toBe('2026-03-02');
  });
  it('never more than 5 weeks', () => {
    for (let m = 1; m <= 12; m++) expect(monthWeeks(`2026-${String(m).padStart(2, '0')}`).length).toBeLessThanOrEqual(5);
  });
});

describe('month helpers', () => {
  it('validMonth accepts YYYY-MM only', () => {
    expect(validMonth('2026-11', '2026-01')).toBe('2026-11');
    expect(validMonth('2026-13', '2026-01')).toBe('2026-01');
    expect(validMonth('nov', '2026-01')).toBe('2026-01');
    expect(validMonth(undefined, '2026-01')).toBe('2026-01');
  });
  it('shiftMonth crosses the year', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('weekDates is Monday to Sunday', () => {
    expect(weekDates('2026-11-02')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  });
});

describe('cells', () => {
  it('a weekly report row becomes a cell by its status', () => {
    expect(cellOf(null)).toEqual({ state: 'none' });
    expect(cellOf({ id: 'a', status: 'sent' })).toEqual({ state: 'sent', id: 'a' });
    expect(cellOf({ id: 'a', status: 'failed' }).state).toBe('failed');
    expect(cellOf({ id: 'a', status: 'skipped' }).state).toBe('skipped');
    expect(cellOf({ id: 'a', status: 'draft' }).state).toBe('draft');
    expect(cellOf({ id: 'a', status: 'sending' }).state).toBe('draft');
  });
  it('a day always has boxes for Sesi 1, 2 and 3: sent, logged-not-sent, or empty', () => {
    const c = sessionCells(new Set([1, 2]), new Map([[1, { id: 'send-1', hasCopy: true }]]));
    expect(c.map((x) => x.session)).toEqual([1, 2, 3]);
    expect(c.map((x) => x.state)).toEqual(['sent', 'logged', 'none']);
    expect(c[0]).toMatchObject({ sendId: 'send-1', hasCopy: true });
    expect(c[1]).toMatchObject({ sendId: null, hasCopy: false });
  });
  it('a sent session counts even if the advertiser log of that session is gone, and a 4th session gets a box', () => {
    const c = sessionCells(new Set([4]), new Map([[2, { id: 's2', hasCopy: false }]]));
    expect(c.map((x) => x.state)).toEqual(['none', 'sent', 'none', 'logged']);
    expect(c[1].hasCopy).toBe(false);
  });
  it('an empty day is three empty boxes', () => {
    expect(sessionCells(new Set(), new Map()).map((x) => x.state)).toEqual(['none', 'none', 'none']);
  });
  it('a session reference round-trips, even when the store name has a bar in it', () => {
    const ref = sessionRef('c-1', 'ProOne - onat.hardware', '2026-11-11', 1);
    expect(ref).toBe('c-1|ProOne - onat.hardware|2026-11-11|1');
    expect(parseSessionRef(ref)).toEqual({ clientId: 'c-1', store: 'ProOne - onat.hardware', date: '2026-11-11', session: 1 });
    expect(parseSessionRef(sessionRef('c-1', 'A|B', '2026-11-11', 2))?.store).toBe('A|B');
    expect(parseSessionRef('nonsense')).toBeNull();
    expect(parseSessionRef(null)).toBeNull();
  });
});
