import { describe, it, expect } from 'vitest';
import { buildPerformance, buildMonthTable, kindsOf, normalizeLogs, weekStart, type LogRow } from './upload-performance';

const row = (id: string, day: string, store: string, project: LogRow['project'] = 'reline'): LogRow => ({ id, at: `${day}T05:00:00.000Z`, day, project, admin: 'Vani', store, type: 'SPOS', month: 'Oktober', files: [], tags: [], owner: '' });

describe('upload performance', () => {
  it('weeks start on Monday (Jakarta)', () => {
    expect(weekStart('2026-10-21')).toBe('2026-10-19'); // Wednesday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
    expect(weekStart('2026-10-26')).toBe('2026-10-26'); // Monday
  });
  it('flags a store with nothing for more than a week as Late, and a store with an upload this week as On Schedule', () => {
    const now = new Date('2026-10-21T03:00:00Z'); // Wednesday 21 Oct, 10:00 Jakarta
    const perf = buildPerformance(
      [row('1', '2026-10-20', 'A Store'), row('2', '2026-10-05', 'B Store')],
      [{ project: 'reline', store: 'C Store', pic: 'Vani' }],
      now,
    );
    const by = Object.fromEntries(perf.map((p) => [p.store, p]));
    expect(by['A Store'].status).toBe('on_schedule');
    expect(by['A Store'].weeks[3].count).toBe(1);
    expect(by['B Store'].status).toBe('late');
    expect(by['B Store'].daysSince).toBe(16);
    expect(by['C Store']).toMatchObject({ status: 'late', lastUpload: null, pic: 'Vani' });
    expect(perf[0].status).toBe('late'); // late stores first
  });
  it('maps Reline workspaces to projects and keeps both sources', () => {
    const { rows, assigned, errors } = normalizeLogs(
      { ok: true, days: [], admins: [{ name: 'Achun', stores: ['sarisurabaya'] }], uploads: [{ id: 'p', uploadedAt: '2026-10-20T05:00:00.000Z', type: 'Ads Performance', admin: 'Vani Admin', store: 'sarisurabaya' }] },
      { ok: true, days: [], admins: [{ name: 'Vani', stores: ['Everest - Jakarta'] }], uploads: [{ id: 'r', uploadedAt: '2026-10-20T05:00:00.000Z', type: 'SPOS', admin: 'Super Admin', store: 'X', workspace: 'Alpha Project' }, { id: 'l', uploadedAt: '2026-10-20T05:00:00.000Z', type: 'SPOS', admin: 'Vani', store: 'Y', workspace: 'Panasonic Light Solution' }] },
    );
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.project).sort()).toEqual(['alpha', 'light', 'profesor']);
    expect(assigned).toEqual([{ project: 'profesor', store: 'sarisurabaya', pic: 'Achun' }, { project: 'reline', store: 'Everest - Jakarta', pic: 'Vani' }]);
  });
  it('reports a failing source without losing the other', () => {
    const { errors, rows } = normalizeLogs({ ok: false, error: 'refused' }, { ok: true, days: [], admins: [], uploads: [{ id: 'r', uploadedAt: '2026-10-20T05:00:00.000Z', type: 'SPOS', admin: 'Vani', store: 'X', workspace: 'Reline Project 1.0' }] });
    expect(errors).toEqual(['Profesor Dashboard: refused']);
    expect(rows).toHaveLength(1);
  });
});

describe('month table', () => {
  it('maps uploads to the kinds of a store', () => {
    expect(kindsOf({ project: 'profesor', type: 'Ads Performance', tags: ['Inkubasi', 'Ads Performance'] }).sort()).toEqual(['adsInkubasi', 'adsTotal']);
    expect(kindsOf({ project: 'profesor', type: 'Store Performance', tags: ['Product Performance'] })).toEqual(['product']);
    expect(kindsOf({ project: 'reline', type: 'Demographic · Shipping', tags: [] })).toEqual(['shipping']);
    expect(kindsOf({ project: 'alpha', type: 'Earning', tags: [] })).toEqual(['earning']);
  });
  it('counts uploads per block of the month and keeps future blocks empty', () => {
    const now = new Date('2026-10-21T03:00:00Z'); // 21 Oct
    const rows = [row('1', '2026-10-02', 'A'), row('2', '2026-10-05', 'A'), row('3', '2026-10-20', 'A'), row('4', '2026-09-30', 'A')];
    const [a] = buildMonthTable(rows, [], 2026, 10, () => 'Acme', now);
    expect(a.client).toBe('Acme');
    expect(a.weeks).toEqual([2, 0, 1, null, null]); // the 22nd and the 29th are still to come
  });
});
