import { describe, it, expect } from 'vitest';
import { lastFullWeek, sumRows, hasActivity, changeText, weeklyMessage, weeklyCaption, weeklyFileName, periodText } from './weekly';
import { normalizeRow, type PerfRow } from '@/lib/integrations/performance';

const row = (periodStart: string, over: any = {}): PerfRow => normalizeRow('dashboard', {
  store: 'Toko A', periodStart, periodEnd: periodStart, granularity: 'week', gmv: 1000000, orders: 10, traffic: 500,
  ads: { total: { cost: 100000, sales: 500000 }, gmvMax: { cost: 60000, sales: 300000 }, group: { cost: 40000, sales: 200000 }, independent: { cost: 0, sales: 0 } },
  ...over,
})!;

describe('lastFullWeek', () => {
  it('on a Monday it is the week that just ended', () => {
    expect(lastFullWeek('2026-11-16')).toEqual({ from: '2026-11-09', to: '2026-11-15', prevFrom: '2026-11-02', prevTo: '2026-11-08' });
  });
  it('on a Sunday and on a Wednesday it is still the week before the current one', () => {
    expect(lastFullWeek('2026-11-15').from).toBe('2026-11-02');
    expect(lastFullWeek('2026-11-18').from).toBe('2026-11-09');
  });
  it('crosses a month boundary', () => {
    expect(lastFullWeek('2026-12-02')).toMatchObject({ from: '2026-11-23', to: '2026-11-29' });
  });
});

describe('sumRows', () => {
  it('adds the rows whose period starts inside the week and ignores the rest', () => {
    const t = sumRows([row('2026-11-09'), row('2026-11-12', { gmv: 500000 }), row('2026-11-16')], '2026-11-09', '2026-11-15')!;
    expect(t.gmv).toBe(1500000);
    expect(t.ads.total.cost).toBe(200000);
  });
  it('is null when there is no row, and activity needs a real number', () => {
    expect(sumRows([row('2026-11-02')], '2026-11-09', '2026-11-15')).toBeNull();
    expect(hasActivity(null)).toBe(false);
    expect(hasActivity(sumRows([row('2026-11-09', { gmv: 0, orders: 0, ads: {} })], '2026-11-09', '2026-11-15'))).toBe(false);
    expect(hasActivity(sumRows([row('2026-11-09')], '2026-11-09', '2026-11-15'))).toBe(true);
  });
});

describe('changeText', () => {
  it('says up, down or the same, and nothing without a comparison', () => {
    expect(changeText(112, 100)).toBe(' (naik 12% dari minggu lalu)');
    expect(changeText(95, 100)).toBe(' (turun 5% dari minggu lalu)');
    expect(changeText(103.5, 100)).toBe(' (naik 3,5% dari minggu lalu)');
    expect(changeText(100.2, 100)).toBe(' (sama seperti minggu lalu)');
    expect(changeText(50, 0)).toBe('');
    expect(changeText(50, null)).toBe('');
  });
});

describe('periodText / caption / file name', () => {
  it('writes the week the way a formal report does', () => {
    expect(periodText('2026-11-02', '2026-11-08')).toBe('2 - 8 Nov 2026');
    expect(periodText('2026-10-26', '2026-11-01')).toBe('26 Okt - 1 Nov 2026');
    expect(periodText('2026-12-28', '2027-01-03')).toBe('28 Des 2026 - 3 Jan 2027');
  });
  it('the caption is the formal title and the store, nothing else', () => {
    expect(weeklyCaption({ store: 'ProOne - Toko A', client: '', from: '2026-11-02', to: '2026-11-08' })).toBe('*Weekly Report* 2 - 8 Nov 2026\nProOne - Toko A');
    expect(weeklyCaption({ store: 'ProOne - Toko A', client: 'Studio Blair', from: '2026-11-02', to: '2026-11-08' })).toBe('*Weekly Report* 2 - 8 Nov 2026\nProOne - Toko A (Studio Blair)');
  });
  it('the file name has no forbidden characters', () => {
    expect(weeklyFileName('ProOne - Toko: A/B', '2026-11-02', '2026-11-08')).toBe('Weekly Report 2-8 Nov 2026 - ProOne - Toko AB.pdf');
  });
});

describe('weeklyMessage', () => {
  const cur = sumRows([row('2026-11-09', { gmv: 12000000 })], '2026-11-09', '2026-11-15')!;
  const prev = sumRows([row('2026-11-02', { gmv: 10000000 })], '2026-11-02', '2026-11-08')!;
  const msg = weeklyMessage({ client: 'Studio Blair', store: 'ProOne - Toko A', from: '2026-11-09', to: '2026-11-15', cur, prev });

  it('is a formal report: title first, no greeting, no sign-off', () => {
    expect(msg.startsWith('*Weekly Report* 9 - 15 Nov 2026\nProOne - Toko A (Studio Blair)\n\n')).toBe(true);
    expect(msg).not.toMatch(/Halo|Salam|saya Oli/);
  });
  it('shows the figures with the change from last week', () => {
    expect(msg).toContain('GMV Toko: Rp 12.000.000 (naik 20% dari minggu lalu)');
    expect(msg).toContain('Pesanan: 10 (sama seperti minggu lalu)');
    expect(msg).toContain('Biaya Iklan: Rp 100.000 (sama seperti minggu lalu)');
    expect(msg).toContain('ROAS: 5x, minggu lalu 5x');
  });
  it('breaks the ads down only when there is more than one type', () => {
    expect(msg).toContain('- GMV Max Auto: biaya Rp 60.000, penjualan Rp 300.000, ROAS 5x');
    expect(msg).toContain('- Group Ads:');
    expect(msg).not.toContain('Iklan Mandiri');
    const one = sumRows([row('2026-11-09', { ads: { total: { cost: 10, sales: 20 }, gmvMax: { cost: 10, sales: 20 } } })], '2026-11-09', '2026-11-15')!;
    expect(weeklyMessage({ client: '', store: 'S', from: '2026-11-09', to: '2026-11-15', cur: one, prev: null })).not.toContain('Rincian iklan');
  });
  it('skips comparisons without a previous week', () => {
    expect(weeklyMessage({ client: '', store: 'S', from: '2026-11-09', to: '2026-11-15', cur, prev: null })).not.toContain('dari minggu lalu');
  });
  it('leaves out the ads block for a store without ads', () => {
    const none = sumRows([row('2026-11-09', { ads: {} })], '2026-11-09', '2026-11-15')!;
    expect(weeklyMessage({ client: 'X', store: 'S', from: '2026-11-09', to: '2026-11-15', cur: none, prev: null })).not.toContain('Biaya Iklan');
  });
});
