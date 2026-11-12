import { describe, it, expect } from 'vitest';
import { classifyFile, buildChecklist, reportMondayOfBlock } from './upload-checklist';

const f = (type: string, name: string, at = '2026-11-11T05:00:00Z') => ({ type, name, admin: 'Vani', at });

describe('upload checklist', () => {
  it('tells the 5 files apart by their names', () => {
    expect(classifyFile('Ads Performance', 'essen ads gmv max nov week 1.csv')).toBe('ads_gmv');
    expect(classifyFile('Ads Performance', 'essen ads nov week 1.csv')).toBe('ads_total');
    expect(classifyFile('Ads Performance', 'essen ads group nov week 1.csv')).toBe('ads_group');
    expect(classifyFile('Store Performance', 'essen ps nov week 1.xlsx')).toBe('store');
    expect(classifyFile('Store Performance', 'essen spos nov week 1.xlsx')).toBe('product');
  });
  it('falls back to the type when the name says nothing', () => {
    expect(classifyFile('SPOS', '(no file name)')).toBe('product');
    expect(classifyFile('Performa', '(no file name)')).toBe('store');
    expect(classifyFile('Ads', 'x.csv')).toBe('ads_total');
  });
  it('is complete only with all 5', () => {
    const four = [f('Store Performance', 'a ps.xlsx'), f('Store Performance', 'a spos.xlsx'), f('Ads Performance', 'a ads.csv'), f('Ads Performance', 'a ads gmv max.csv')];
    expect(buildChecklist(four)).toMatchObject({ count: 4, complete: false });
    expect(buildChecklist([...four, f('Ads Performance', 'a ads group.csv')])).toMatchObject({ count: 5, complete: true });
  });
  it('finds the Monday inside a block of the month', () => {
    expect(reportMondayOfBlock(2026, 11, 0)).toBe('2026-11-02');
    expect(reportMondayOfBlock(2026, 11, 1)).toBe('2026-11-09');
    expect(reportMondayOfBlock(2026, 11, 4)).toBe('2026-11-30');
  });
});
