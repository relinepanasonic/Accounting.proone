import { describe, it, expect } from 'vitest';
import { compareSessions } from './report-utils';

const row = (modal: string, target: string, name = 'Iklan A') => ({ iklanProduk: name, modalHarian: modal, targetRoas: target });
const prev = { session: 2, report_date: '2026-11-09', data_inkubasi: [row('100000', '10')], data_group: [], data_mandiri: [] };
const line = (cur: any) => compareSessions({ data_inkubasi: [cur], data_group: [], data_mandiri: [] }, prev)[0].lines[0];

describe('colours of the changes in the advertiser report', () => {
  it('a raised modal harian is green and a lowered Target ROAS is red', () => {
    const l = line(row('150000', '8'));
    const tones = l.segments.map((s) => s.tone);
    expect(tones).toContain('up');
    expect(tones).toContain('down');
    expect(l.segments.find((s) => s.tone === 'up')?.text).toMatch(/modal harian naik/i);
    expect(l.segments.find((s) => s.tone === 'down')?.text).toMatch(/Target ROAS diturunkan/);
    expect(l.segments.map((s) => s.text).join('')).toBe(l.text);
  });
  it('nothing changed (stay) is one dark grey piece', () => {
    const l = line(row('100000', '10'));
    expect(l.segments).toEqual([{ text: l.text, tone: 'same' }]);
    expect(l.text).toMatch(/^Stay \(/);
  });
  it('a mix: modal up is green, Target ROAS that stayed is grey', () => {
    const l = line(row('120000', '10'));
    expect(l.segments.filter((s) => s.tone !== 'plain').map((s) => s.tone)).toEqual(['same', 'up']);
  });
});

import { rowDirs, pctChange, statChanges, vsLabel } from './report-utils';

describe('table cell colours and % against the session before', () => {
  const a = (name: string, modal: string, target: string, biaya = '', jual = '') => ({ iklanProduk: name, modalHarian: modal, targetRoas: target, biayaIklan: biaya, penjualan: jual });
  it('rows are matched by name: target down, modal up, a new row has no colour', () => {
    const dirs = rowDirs([a('X', '60000', '11'), a('Y', '30000', '15'), a('Z', '10000', '9')], [a('X', '50000', '12'), a('Y', '30000', '15')]);
    expect(dirs[0]).toEqual({ modal: 'up', target: 'down' });
    expect(dirs[1]).toEqual({ modal: 'same', target: 'same' });
    expect(dirs[2]).toEqual({ modal: null, target: null });
  });
  it('percent change', () => {
    expect(pctChange(112.5, 100)).toEqual({ dir: 'up', text: '▲ 12.5%' });
    expect(pctChange(92, 100)).toEqual({ dir: 'down', text: '▼ 8%' });
    expect(pctChange(100, 100)).toEqual({ dir: 'same', text: '0%' });
    expect(pctChange(5, 0)).toBeNull();
  });
  it('the four numbers of a section', () => {
    const c = statChanges([a('X', '200000', '10', '100000', '700000')], [a('X', '100000', '10', '100000', '500000')]);
    expect(c?.modal?.text).toBe('▲ 100%');
    expect(c?.jual?.dir).toBe('up');
    expect(c?.biaya?.dir).toBe('same');
    expect(c?.roas?.text).toBe('▲ 40%');
  });
  it('"vs" label: yesterday, same day, or the date', () => {
    expect(vsLabel('2026-11-10', { session: 3, report_date: '2026-11-09' })).toBe('kemarin');
    expect(vsLabel('2026-11-10', { session: 1, report_date: '2026-11-10' })).toBe('Sesi 1');
    expect(vsLabel('2026-11-10', { session: 3, report_date: '2026-11-07' })).toMatch(/^07 /);
  });
});
