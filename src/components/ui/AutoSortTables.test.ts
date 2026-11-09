import { describe, it, expect } from 'vitest';
import { keyOf, compare } from './AutoSortTables';

const cell = (text: string, html = '') => ({ textContent: text, innerHTML: html || text }) as any;
const sorted = (values: string[]) => values.map((v) => ({ v, k: keyOf(cell(v)) })).sort((a, b) => compare(a.k, b.k)).map((x) => x.v);

describe('sorting the cells of a table', () => {
  it('rupiah and plain numbers in the Indonesian format sort by value, not by text', () => {
    expect(sorted(['Rp 1.200.000', 'Rp 90.000', 'Rp 12.500.000', '-Rp 5.000'])).toEqual(['-Rp 5.000', 'Rp 90.000', 'Rp 1.200.000', 'Rp 12.500.000']);
    expect(sorted(['10,5', '9', '100'])).toEqual(['9', '10,5', '100']);
    expect(sorted(['7.77x', '10.01x', '9.5x'])).toEqual(['7.77x', '9.5x', '10.01x']);
  });
  it('dates sort by day', () => {
    expect(sorted(['09 Nov 2026', '30 Okt 2026', '04 Nov 2025'])).toEqual(['04 Nov 2025', '30 Okt 2026', '09 Nov 2026']);
    expect(sorted(['2026-11-09', '2026-01-30'])).toEqual(['2026-01-30', '2026-11-09']);
  });
  it('names sort A to Z, numbers inside names in order', () => {
    expect(sorted(['Toko 10', 'angkasa', 'Toko 2', 'BNC'])).toEqual(['angkasa', 'BNC', 'Toko 2', 'Toko 10']);
  });
  it('an icon column sorts green before draft before empty', () => {
    const k = (html: string) => keyOf(cell('', html));
    expect(compare(k('<svg class="text-emerald-500"/>'), k('<svg class="text-zinc-700"/>'))).toBeGreaterThan(0);
    expect(compare(k('<svg class="text-amber-400"/>'), k('<svg class="text-zinc-700"/>'))).toBeGreaterThan(0);
  });
});
