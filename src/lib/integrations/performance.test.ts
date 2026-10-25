import { describe, it, expect } from 'vitest';
import { normalizeRow, buildView, lastMonths, rangeBuckets, bucketOf, adsCost, adsSales, roas, storeKeyOf } from './performance';

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
    expect(storeKeyOf({ source: 'reline', store: 'D', workspace: 'Alpha Project' })).toBe('reline:D|Alpha Project');
    expect(all.stores[0].cost[8]).toBe(15);
    const one = buildView(rows, 2026, 0, 'reline:Dealer X');
    expect(one.totals.sales).toBe(7);
    expect(one.stores).toHaveLength(3);
    expect(adsCost(all.totals)).toBe(45);
    expect(roas(adsSales(all.totals), adsCost(all.totals))).toBe(6);
  });

  it('baseline is one number per store: it is not multiplied by the number of weeks', () => {
    const rows = [
      row({ periodStart: '2026-09-07', baselineSales: 5_000_000 }),
      row({ periodStart: '2026-09-14', baselineSales: 5_000_000 }),
      row({ periodStart: '2026-09-21', baselineSales: 5_000_000 }),
      row({ store: 'Store B', periodStart: '2026-09-07', baselineSales: 2_000_000 }),
    ];
    const year = buildView(rows, 2026, 0, '');
    expect(year.totals.baselineSales).toBe(7_000_000);
    expect(year.buckets[8].baselineSales).toBe(7_000_000);
    const sep = buildView(rows, 2026, 9, '');
    expect(sep.totals.baselineSales).toBe(7_000_000);
    expect(sep.buckets[0].baselineSales).toBe(1_750_000); // the month baseline over about 4 weeks
    expect(buildView(rows, 2026, 0, 'dashboard:Store B').totals.baselineSales).toBe(2_000_000);
  });

  it('when the app sends no active sales, active is the sales', () => {
    const v = buildView([row({ activeSales: 0 })], 2026, 0, '');
    expect(v.totals.activeSales).toBe(100);
    expect(v.buckets[8].activeSales).toBe(100);
  });

  it('uses the feed total for ads when it comes, and sums the three types when it does not', () => {
    const withTotal = row({ ads: { total: { cost: 40, sales: 200, addToCart: 9 }, gmvMax: { cost: 10, sales: 60 }, group: { cost: 5, sales: 30 }, independent: { cost: 25, sales: 110 } } });
    expect(withTotal.ads.total.cost).toBe(40);
    expect(withTotal.ads.total.addToCart).toBe(9);
    const sum = row({});
    expect(sum.ads.total.cost).toBe(15);
    expect(sum.ads.total.sales).toBe(90);
  });

  it('the last 6 months cross the year; a short date range goes per week, a long one per month', () => {
    const six = lastMonths(6, '2027-02-10');
    expect(six.from).toBe('2026-09-01');
    expect(six.labels).toEqual(['Sep 26', 'Okt 26', 'Nov 26', 'Des 26', 'Jan 27', 'Feb 27']);
    expect(six.bucket('2026-12-28')).toBe(3);
    expect(six.bucket('2026-08-31')).toBe(-1);
    const rows = [{ periodStart: '2026-09-07' }, { periodStart: '2026-09-14' }, { periodStart: '2026-10-05' }];
    const short = rangeBuckets(rows, '2026-09-01', '2026-09-30');
    expect(short.labels).toEqual(['07 Sep', '14 Sep']);
    expect(short.bucket('2026-10-05')).toBe(-1);
    const long = rangeBuckets(rows, '2026-08-15', '2026-12-31');
    expect(long.labels).toEqual(['Agu 26', 'Sep 26', 'Okt 26', 'Nov 26', 'Des 26']);
    expect(long.bucket('2026-10-05')).toBe(2);
  });
});
