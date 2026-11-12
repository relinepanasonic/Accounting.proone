import { describe, it, expect } from 'vitest';
import { analyze } from './analysis';
import { sumRows, type WeekPoint } from './weekly';
import { normalizeRow, type PerfRow } from '@/lib/integrations/performance';

const row = (d: string, over: any = {}): PerfRow => normalizeRow('dashboard', {
  store: 'Toko A', periodStart: d, periodEnd: d, granularity: 'week', sales: 100000000, gmv: 100000000, traffic: 10000, addToCart: 4000, orders: 800,
  ads: { total: { cost: 10000000, sales: 90000000 }, gmvMax: { cost: 4000000, sales: 40000000 }, group: { cost: 4000000, sales: 36000000 }, independent: { cost: 2000000, sales: 14000000 } }, ...over,
})!;
const tot = (over: any, d = '2026-11-02') => sumRows([row(d, over)], d, d)!;
const pt = (sales: number): WeekPoint => ({ from: '2026-10-05', to: '2026-10-11', sales, adCost: 1, adSales: 1, orders: 1, traffic: 1 });

describe('analyze', () => {
  it('a rise in sales is a win with both figures', () => {
    const a = analyze(tot({ sales: 120000000 }), tot({ sales: 100000000 }, '2026-10-26'));
    const f = a.findings.find((x) => x.title.startsWith('Penjualan naik'))!;
    expect(f).toMatchObject({ tone: 'win', title: 'Penjualan naik 20%' });
    expect(f.text).toContain('Rp 120.000.000');
    expect(f.text).toContain('Rp 100.000.000');
  });

  it('a fall in sales is a watch point and brings a tip', () => {
    const a = analyze(tot({ sales: 80000000 }), tot({ sales: 100000000 }, '2026-10-26'));
    expect(a.findings.some((x) => x.tone === 'watch' && x.title === 'Penjualan turun 20%')).toBe(true);
    expect(a.tips.join(' ')).toMatch(/stok/);
  });

  it('small changes are not findings', () => {
    const a = analyze(tot({ sales: 102000000 }), tot({}, '2026-10-26'));
    expect(a.findings).toEqual([{ tone: 'win', title: 'Performa stabil', text: 'Tidak ada perubahan besar dibanding minggu lalu.' }]);
    expect(a.tips).toEqual(['Pertahankan strategi minggu ini dan pantau lagi minggu depan.']);
  });

  it('compares with the average of the weeks before, only when there are at least 3', () => {
    const cur = tot({ sales: 150000000 });
    const withHistory = analyze(cur, null, [pt(100000000), pt(100000000), pt(100000000), pt(100000000), { ...pt(150000000) }]);
    expect(withHistory.findings.some((f) => f.title.includes('di atas rata-rata 4 minggu sebelumnya'))).toBe(true);
    const thin = analyze(cur, null, [pt(0), pt(0), pt(100000000), pt(100000000), pt(150000000)]);
    expect(thin.findings.some((f) => f.title.includes('rata-rata'))).toBe(false);
  });

  it('flags a falling ROAS (Penjualan / Biaya Iklan)', () => {
    const a = analyze(tot({ sales: 100000000, ads: { total: { cost: 20000000, sales: 90000000 } } }), tot({}, '2026-10-26'));
    const f = a.findings.find((x) => x.title.startsWith('ROAS turun'))!;
    expect(f.tone).toBe('watch');
    expect(f.text).toBe('5x minggu ini vs 10x minggu lalu.');
  });

  it('flags ad cost rising while sales do not', () => {
    const a = analyze(tot({ ads: { total: { cost: 15000000, sales: 90000000 } } }), tot({}, '2026-10-26'));
    expect(a.findings.some((f) => f.title.startsWith('Biaya iklan naik 50%'))).toBe(true);
  });

  it('flags abandoned carts above 90 percent', () => {
    const a = analyze(tot({ addToCart: 20000, orders: 600 }), null);
    expect(a.findings.find((f) => f.title.includes('keranjang tidak jadi pesanan'))!.title).toBe('97% keranjang tidak jadi pesanan');
    expect(a.tips.join(' ')).toMatch(/ongkir/);
  });

  it('points at the ad type that takes the budget but earns less than another', () => {
    const ads = { total: { cost: 10000000, sales: 90000000 }, gmvMax: { cost: 1000000, sales: 24000000 }, group: { cost: 7000000, sales: 70000000 }, independent: { cost: 2000000, sales: 20000000 } };
    const a = analyze(tot({ ads }), null);
    const f = a.findings.find((x) => x.title.includes('belanja paling besar'))!;
    expect(f.title).toBe('Iklan Grup adalah belanja paling besar tetapi bukan yang paling efisien');
    expect(f.text).toBe('Iklan Grup mengambil 70% budget iklan di 10x, sedangkan GMV Max Auto menghasilkan 24x.');
    expect(a.tips).toContain('Pindahkan sebagian budget Iklan Grup ke GMV Max Auto lalu ukur ulang minggu depan.');
  });

  it('shows at most 5 findings, watch points first, and 3 tips', () => {
    const ads = { total: { cost: 30000000, sales: 60000000 }, gmvMax: { cost: 1000000, sales: 24000000 }, group: { cost: 25000000, sales: 30000000 }, independent: { cost: 4000000, sales: 6000000 } };
    const a = analyze(tot({ sales: 70000000, addToCart: 30000, orders: 500, traffic: 15000, ads }), tot({}, '2026-10-26'));
    expect(a.findings.length).toBeLessThanOrEqual(5);
    expect(a.tips.length).toBeLessThanOrEqual(3);
    expect(a.findings[0].tone).toBe('watch');
  });
});
