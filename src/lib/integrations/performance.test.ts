import { describe, it, expect } from 'vitest';
import { normalizeRow, buildView, bucketOf, adsCost, adsSales, roas } from './performance';

const row = (over: any) => normalizeRow(over.source || 'dashboard', {
  store: 'Store A', periodStart: '2026-09-07', granularity: 'week', sales: 100, gmv: 150, traffic: 1000, addToCart: 50, orders: 10,
  ads: { gmvMax: { cost: 10, sales: 60, views: 500, clicks: 20 }, group: { cost: 5, sales: 30 }, independent: { cost: 0, sales: 0 } },
  ...over,
})!;

describe('store performance', () => {
  it('keeps a bad row out and fills missing numbers with 0', () => {
    expect(normalizeRow('reline', { periodStart: '2026-09-01' })).toBeNull();
    expect(normalizeRow('reline', { dealer: 'Dealer X', periodStart: 'x' })).toBeNull();
    const r = normalizeRow('reline', { dealer: 'Dealer X', periodStart: '2026-09-01' })!;
    expect(r.store).toBe('Dealer X');
    expect(r.ads.group.cost).toBe(0);
  });

  it('months for a year, weeks for a month', () => {
    expect(bucketOf('2026-09-07', 2026, 0)).toBe(8);
    expect(bucketOf('2026-09-07', 2026, 9)).toBe(0);
    expect(bucketOf('2026-09-15', 2026, 9)).toBe(2);
    expect(bucketOf('2026-09-30', 2026, 9)).toBe(4);
    expect(bucketOf('2026-08-30', 2026, 9)).toBe(-1);
    expect(bucketOf('2025-09-07', 2026, 0)).toBe(-1);
  });

  it('adds up the stores, and the Store filter narrows the totals but keeps the store table', () => {
    const rows = [row({}), row({ store: 'Store B', sales: 40, periodStart: '2026-10-05' }), row({ source: 'reline', store: 'Dealer X', sales: 7 })];
    const all = buildView(rows, 2026, 0, '');
    expect(all.totals.sales).toBe(147);
    expect(all.buckets[8].sales).toBe(107);
    expect(all.buckets[9].sales).toBe(40);
    expect(all.stores.map((s) => s.key)).toEqual(['dashboard:Store A', 'dashboard:Store B', 'reline:Dealer X']);
    expect(all.stores[0].series[8]).toBe(100);
    const one = buildView(rows, 2026, 0, 'reline:Dealer X');
    expect(one.totals.sales).toBe(7);
    expect(one.stores).toHaveLength(3);
    expect(adsCost(all.totals)).toBe(45);
    expect(roas(adsSales(all.totals), adsCost(all.totals))).toBe(6);
  });
});
