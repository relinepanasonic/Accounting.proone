import { describe, it, expect } from 'vitest';
import { buildPerformance, buildMonthTable, weekOfFile, normalizeLogs, weekStart, type LogRow } from './upload-performance';

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
  it('takes the week from the file name, else from the day of the upload', () => {
    expect(weekOfFile('aks ads grup okt week 2.csv', '2026-10-19')).toBe(2);
    expect(weekOfFile('studio ads sep Week 3.csv', '2026-10-02')).toBe(3);
    expect(weekOfFile('performa.csv', '2026-10-16')).toBe(3);
    expect(weekOfFile('performa.csv', '2026-10-30')).toBe(5);
  });
  it('lists the files of each week, keeps weeks to come empty, and sets the status', () => {
    const now = new Date('2026-10-21T03:00:00Z'); // Wednesday 21 Oct
    const r1: LogRow = { ...row('1', '2026-10-19', 'A'), files: ['a spos week 1.csv', 'a spos week 2.csv'] };
    const r2: LogRow = { ...row('2', '2026-10-20', 'A'), files: ['a perf.csv'] }; // no week in the name: the 15-21 block = week 3
    const [a, b] = buildMonthTable([r1, r2, row('3', '2026-10-02', 'B')], [], 2026, 10, (st) => (st === 'A' ? 'Acme' : ''), now);
    expect(a.client).toBe('Acme');
    expect(a.weekFiles.map((w) => (w === null ? null : w.length))).toEqual([1, 1, 1, null, null]);
    expect(a.weekFiles[2]![0].name).toBe('a perf.csv');
    expect(a.status).toBe('on_schedule'); // a file this week
    expect(b.status).toBe('late'); // last upload 2 Oct, nothing in the last 7 days
  });
  it('a past month is On Schedule only when every week has a file', () => {
    const now = new Date('2026-11-10T03:00:00Z');
    const full: LogRow[] = [1, 8, 15, 22, 29].map((d) => row(String(d), `2026-10-${String(d).padStart(2, '0')}`, 'A'));
    expect(buildMonthTable(full, [], 2026, 10, () => '', now)[0].status).toBe('on_schedule');
    expect(buildMonthTable(full.slice(0, 3), [], 2026, 10, () => '', now)[0].status).toBe('late');
  });
});
