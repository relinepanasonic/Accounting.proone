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
