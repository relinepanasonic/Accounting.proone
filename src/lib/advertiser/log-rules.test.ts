import { describe, it, expect } from 'vitest';
import { isFilled, rowUsed, missingNumbers, tabState, snapshotOf } from './log-rules';

describe('Input Log rules', () => {
  it('0 is filled, empty is not', () => {
    expect(isFilled('Rp 0')).toBe(true);
    expect(isFilled('0')).toBe(true);
    expect(isFilled('')).toBe(false);
    expect(isFilled('   ')).toBe(false);
    expect(isFilled(undefined)).toBe(false);
  });
  it('untouched rows are ignored, a row with the ad or the budget is in use', () => {
    expect(rowUsed({ infoIklan: '', modalHarian: '', biayaIklan: '' })).toBe(false);
    expect(rowUsed({ infoIklan: 'Kasa nyamuk', biayaIklan: '' })).toBe(true);
    expect(rowUsed({ modalHarian: 'Rp 25,000' })).toBe(true);
  });
  it('lists what has to be filled before saving, by tab and group', () => {
    const m = missingNumbers(
      [{ modalHarian: 'Rp 1', biayaIklan: '', penjualan: '' }, { modalHarian: '', biayaIklan: '', penjualan: '' }],
      [{ groupCategory: 'Hero', groupName: 'Group Hero 1', modalHarian: 'Rp 5', biayaIklan: 'Rp 0', penjualan: '' }, { groupCategory: 'Hero', groupName: 'Group Hero 1', modalHarian: 'Rp 5', biayaIklan: 'Rp 0', penjualan: 'Rp 0' }],
      [{ infoIklan: 'A', biayaIklan: 'Rp 0', penjualan: 'Rp 0' }],
    );
    expect(m.map((x) => `${x.label}:${x.rows}`)).toEqual(['GMV Max Auto:1', 'Iklan Group:1']);
    expect(m[0].where).toEqual(['row 1: Biaya Iklan + Penjualan']);
    expect(m[1].where).toEqual(['row 1: Penjualan']);
    expect(missingNumbers([], [], [{ infoIklan: 'A', biayaIklan: 'Rp 0', penjualan: 'Rp 0' }])).toEqual([]);
  });
  it('a tab is green when saved with numbers, amber when it differs from what is saved', () => {
    const rows = [{ infoIklan: 'A', biayaIklan: 'Rp 0', penjualan: 'Rp 5' }];
    expect(tabState(rows, snapshotOf(rows))).toBe('saved');
    expect(tabState([{ ...rows[0], penjualan: 'Rp 6' }], snapshotOf(rows))).toBe('edited');
    expect(tabState([{ infoIklan: '' }], '')).toBe('none');
    expect(tabState([{ infoIklan: 'A', biayaIklan: '', penjualan: '' }], '')).toBe('edited');
  });
});
