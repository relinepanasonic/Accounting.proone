import { describe, it, expect } from 'vitest';
import { buildPerformance, buildMonthTable, normalizeLogs, weekStart, mondaysOf, monthFromText, dataWeekOf, type LogRow } from './upload-performance';

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
  it('weeks run Monday to Sunday and belong to the month of their Monday', () => {
    expect(mondaysOf(2026, 11)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(mondaysOf(2026, 10)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });
  it('reads the month and the week from the file name', () => {
    expect(monthFromText('essen ads gmv max nov week 1.csv')).toEqual({ month: 11, year: null });
    expect(monthFromText('essen ps sep 26.xlsx')).toEqual({ month: 9, year: 2026 });
    expect(monthFromText('aks ads grup okt week 2.csv')).toEqual({ month: 10, year: null });
    expect(dataWeekOf('essen ads nov week 1.csv', '', '2026-11-11')).toBe('2026-11-02');
    expect(dataWeekOf('aks ads grup okt week 4.csv', '', '2026-11-03')).toBe('2026-10-26'); // October week 4, uploaded in November
    expect(dataWeekOf('essen ps sep 26.xlsx', '', '2026-11-03')).toBeNull(); // a whole month (September): not a week of November
    expect(dataWeekOf('performa.csv', '', '2026-11-11')).toBe('2026-11-02'); // no week: the week before the upload
    expect(dataWeekOf('ads week 4.csv', '', '2026-11-03')).toBe('2026-10-26'); // no month: the month of the week before the upload
    expect(dataWeekOf('performa.csv', 'Oktober', '2026-11-03')).toBe('2026-10-26');
  });
  it('14 November: only week 1 (2-8 Nov) is due; October files uploaded in November stay out; weeks not ended are -', () => {
    const now = new Date('2026-11-14T03:00:00Z');
    const r1: LogRow = { ...row('1', '2026-11-11', 'A', 'profesor'), files: ['a ads nov week 1.csv', 'a spos nov week 1.xlsx'] };
    const r2: LogRow = { ...row('2', '2026-11-03', 'A', 'profesor'), files: ['a ads okt week 4.csv', 'a ps sep 26.xlsx'] };
    const r3: LogRow = { ...row('3', '2026-11-03', 'B', 'profesor'), files: ['b ads okt week 4.csv'] };
    const t = buildMonthTable([r1, r2, r3], [{ project: 'profesor', store: 'C', pic: 'Vani' }], 2026, 11, (st) => (st === 'A' ? 'Acme' : ''), now);
    const by = Object.fromEntries(t.map((x) => [x.store, x]));
    expect(by.A.client).toBe('Acme');
    expect(by.A.weekFiles.map((w) => (w === null ? null : w.length))).toEqual([2, null, null, null, null]);
    expect(by.A.status).toBe('on_schedule');
    expect(by.B).toBeUndefined(); // only October files: not a November store
    expect(by.C.weekFiles[0]).toEqual([]); // week 1 ended and nothing came
    expect(by.C.status).toBe('late');
  });
  it('the last ended week may be up to 3 days late', () => {
    const t = (iso: string) => buildMonthTable([], [{ project: 'profesor', store: 'C', pic: '' }], 2026, 11, () => '', new Date(iso))[0].status;
    expect(t('2026-11-10T03:00:00Z')).toBe('on_schedule'); // week 1 ended 8 Nov, 2 days ago
    expect(t('2026-11-13T03:00:00Z')).toBe('late');        // 5 days ago
    expect(t('2026-11-01T03:00:00Z')).toBeNull();          // nothing due yet
  });
  it('a past month is On Schedule only when every week has a file', () => {
    const now = new Date('2026-11-20T03:00:00Z');
    const full: LogRow[] = [1, 2, 3, 4].map((n) => ({ ...row(String(n), '2026-11-02', 'A'), files: [`a okt week ${n}.csv`] }));
    expect(buildMonthTable(full, [], 2026, 10, () => '', now)[0].status).toBe('on_schedule');
    expect(buildMonthTable(full.slice(0, 3), [], 2026, 10, () => '', now)[0].status).toBe('late');
  });
});
