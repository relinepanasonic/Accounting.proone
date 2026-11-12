import { describe, it, expect } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import { normalizeRow, type PerfRow } from '@/lib/integrations/performance';
import { sumRows, weeklySeries, type WeeklyPayload } from './weekly';
import { niceMax, renderWeeklyPdf, shortRp, summaryLine } from './weekly-pdf';

const row = (d: string, k: number): PerfRow => normalizeRow('dashboard', {
  store: 'onat.hardware', periodStart: d, periodEnd: d, granularity: 'week', sales: 100000000 * k, gmv: 100000000 * k, traffic: 12000 * k, addToCart: 38000 * k, orders: 1200 * k,
  ads: { total: { cost: 6000000 * k, sales: 90000000 * k }, gmvMax: { cost: 700000 * k, sales: 17000000 * k }, group: { cost: 3700000 * k, sales: 52000000 * k }, independent: { cost: 1600000 * k, sales: 21000000 * k } },
})!;

const ROWS = [['2026-10-12', 0.8], ['2026-10-19', 0.9], ['2026-10-26', 1.0], ['2026-11-02', 1.05], ['2026-11-09', 1.2]].map(([d, k]) => row(d as string, k as number));

const payload = (over: Partial<WeeklyPayload> = {}): WeeklyPayload => ({
  store: 'ProOne - onat.hardware', client: 'Onat', from: '2026-11-09', to: '2026-11-15',
  cur: sumRows(ROWS, '2026-11-09', '2026-11-15')!, prev: sumRows(ROWS, '2026-11-02', '2026-11-08'),
  series: weeklySeries(ROWS, '2026-11-09'),
  products: Array.from({ length: 10 }, (_, i) => ({ name: `ONAT Roda Caster Nylon PU PVC Orange ${i + 3} Inch Medium Duty`, sales: (11 - i) * 2000000 })),
  ...over,
});

async function pages(p: WeeklyPayload) {
  const pdf = await renderWeeklyPdf(p);
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(doc, { mergePages: false });
  return { totalPages, text: text as string[] };
}

describe('weekly PDF', () => {
  it('is exactly two pages and has no cover page', async () => {
    const { totalPages, text } = await pages(payload());
    expect(totalPages).toBe(2);
    expect(text[0]).toContain('Weekly Report');
    expect(text[0]).toContain('TOTAL PENJUALAN');           // page 1 opens with the numbers, not a cover
    expect(text[0]).not.toMatch(/DISIAPKAN UNTUK|Dibuat/);
  });

  it('page 1: summary, key numbers, the two weekly charts (5 weeks) and the ad types', async () => {
    const { text } = await pages(payload());
    const p1 = text[0];
    expect(p1).toContain('Pada 9 - 15 Nov 2026, ProOne - onat.hardware membukukan penjualan Rp 120.000.000 dari 14.400 pengunjung');
    expect(p1).toContain('Penjualan per Minggu');
    expect(p1).toContain('Biaya Iklan & ROAS per Minggu');
    for (const w of ['12-18 Okt', '19-25 Okt', '26 Okt-1 Nov', '2-8 Nov', '9-15 Nov']) expect(p1).toContain(w);
    expect(p1).toContain('ROAS 16,7x');
    expect(p1).toContain('Efisiensi Iklan Minggu Ini');
    expect(p1).toContain('GMV Max Auto');
  });

  it('page 2: the 10 products and the findings', async () => {
    const { text } = await pages(payload());
    const p2 = text[1];
    expect(p2).toContain('10 Produk Terlaris');
    expect(p2).toContain('ONAT Roda Caster Nylon PU PVC Orange 3 Inch Medium Duty');
    expect(p2).toContain('Temuan & Langkah Berikutnya');
    // the labels are letter-spaced in the PDF, so the extractor puts spaces between their letters
    const squeezed = p2.replace(/\s+/g, '');
    expect(squeezed).toMatch(/WIN|PERHATIAN/);
    expect(squeezed).toContain('REKOMENDASITINDAKAN');
  });

  it('without product data page 2 says so instead of inventing a list', async () => {
    const { totalPages, text } = await pages(payload({ products: null }));
    expect(totalPages).toBe(2);
    expect(text[1]).toContain('Data produk minggu ini belum tersedia');
    expect(text[1]).toContain('Temuan & Langkah Berikutnya');
  });

  it('an older draft without the weekly series still makes two pages', async () => {
    const { totalPages, text } = await pages(payload({ series: undefined, products: undefined }));
    expect(totalPages).toBe(2);
    expect(text[0]).toContain('Penjualan per Minggu');
  });

  it('a store with no ads and no previous week still renders', async () => {
    const quiet = normalizeRow('dashboard', { store: 'Toko Kecil', periodStart: '2026-11-09', sales: 5000000, orders: 20, traffic: 400 })!;
    const { totalPages } = await pages({ store: 'ProOne - Toko Kecil', client: '', from: '2026-11-09', to: '2026-11-15', cur: sumRows([quiet], '2026-11-09', '2026-11-15')!, prev: null, series: weeklySeries([quiet], '2026-11-09'), products: null });
    expect(totalPages).toBe(2);
  });
}, 60000);

describe('chart helpers', () => {
  it('shortRp writes money short', () => {
    expect(shortRp(0)).toBe('0');
    expect(shortRp(850000)).toBe('850 rb');
    expect(shortRp(2400000)).toBe('2,4 jt');
    expect(shortRp(125000000)).toBe('125 jt');
    expect(shortRp(3100000000)).toBe('3,1 M');
  });
  it('niceMax rounds an axis up to 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(462513397)).toBe(500000000);
    expect(niceMax(120000000)).toBe(200000000);
    expect(niceMax(26449692)).toBe(50000000);
    expect(niceMax(20000000)).toBe(20000000);
  });
  it('summaryLine leaves out what the store does not have', () => {
    const t = normalizeRow('dashboard', { store: 'S', periodStart: '2026-11-09', sales: 5000000 })!;
    expect(summaryLine({ store: 'S', client: '', from: '2026-11-09', to: '2026-11-15', cur: sumRows([t], '2026-11-09', '2026-11-15')!, prev: null })).toBe('Pada 9 - 15 Nov 2026, S membukukan penjualan Rp 5.000.000.');
  });
});
