import { describe, it, expect } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import { normalizeRow, type PerfRow } from '@/lib/integrations/performance';
import { sumRows, weeklySeries, type WeeklyPayload } from './weekly';
import { barColumns, CHART_LEFT, CHART_W, niceMax, pdfText, renderWeeklyPdf, shortRp, summaryLine } from './weekly-pdf';

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
  it('is exactly ONE page (so it also works as an image) and has no cover', async () => {
    const { totalPages, text } = await pages(payload());
    expect(totalPages).toBe(1);
    expect(text[0]).toContain('Weekly Report');
    expect(text[0]).toContain('TOTAL PENJUALAN');           // it opens with the numbers, not a cover
    expect(text[0]).not.toMatch(/DISIAPKAN UNTUK|Dibuat/);
  });

  it('has the summary, the key numbers, the ad types and the analysis (top right) on the one page', async () => {
    const { text } = await pages(payload());
    const p1 = text[0];
    expect(p1).toContain('Pada 9 - 15 Nov 2026, onat.hardware membukukan penjualan Rp 120.000.000 dari 14.400 pengunjung');
    expect(p1).not.toMatch(/ProOne|Reline/);          // the company is not for the client
    expect(p1).toContain('Efisiensi Iklan Minggu Ini');
    expect(p1).toContain('GMV Max Auto');
    expect(p1).toContain('Temuan & Langkah Berikutnya');
    const squeezed = p1.replace(/\s+/g, '');                // the labels are letter-spaced, so the extractor puts spaces between their letters
    expect(squeezed).toMatch(/WIN|PERHATIAN/);
    expect(squeezed).toContain('REKOMENDASIMINGGUBERIKUTNYA');
  });

  it('has the two weekly charts with 5 weeks and the ROAS line', async () => {
    const { text } = await pages(payload());
    const p1 = text[0];
    expect(p1).toContain('Penjualan per Minggu');
    expect(p1).toContain('Biaya Iklan & ROAS per Minggu');
    for (const w of ['12-18 Okt', '19-25 Okt', '26 Okt-1 Nov', '2-8 Nov', '9-15 Nov']) expect(p1).toContain(w);
    expect((p1.match(/16,7x/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(p1).toContain('(garis)');
    expect(p1).toContain('(batang)');
  });

  it('shows the 5 best products when the app sends them, and still fits the one page', async () => {
    const { totalPages, text } = await pages(payload());      // the payload holds 10 products: only 5 are drawn
    expect(totalPages).toBe(1);
    expect(text[0]).toContain('5 Produk Terlaris');
    expect(text[0]).toContain('ONAT Roda Caster Nylon PU PVC Orange 3 Inch Medium Duty');
    expect(text[0]).toContain('ONAT Roda Caster Nylon PU PVC Orange 7 Inch Medium Duty');       // the 5th
    expect(text[0]).not.toContain('ONAT Roda Caster Nylon PU PVC Orange 8 Inch Medium Duty');   // the 6th is left out
  });

  it('without product data the products block is simply left out', async () => {
    const { totalPages, text } = await pages(payload({ products: null }));
    expect(totalPages).toBe(1);
    expect(text[0]).not.toContain('Produk Terlaris');
    expect(text[0]).toContain('Temuan & Langkah Berikutnya');
  });

  it('the worst case still fits one page: long product names, three findings and two tips', async () => {
    const long = Array.from({ length: 10 }, (_, i) => ({ name: `ONAT Roda pagar pintu gerbang geser rel bubut besi katrol model tipe U ukuran ${i + 1} sangat panjang sekali nama produknya di marketplace`, sales: (11 - i) * 1000000 }));
    const weak = normalizeRow('dashboard', { store: 'onat.hardware', periodStart: '2026-11-09', sales: 60000000, gmv: 70000000, traffic: 15000, addToCart: 40000, orders: 700,
      ads: { total: { cost: 30000000, sales: 50000000 }, gmvMax: { cost: 1000000, sales: 24000000 }, group: { cost: 25000000, sales: 30000000 }, independent: { cost: 4000000, sales: 6000000 } } })!;
    const { totalPages } = await pages(payload({ cur: sumRows([weak], '2026-11-09', '2026-11-15')!, products: long }));
    expect(totalPages).toBe(1);
  });

  it('an older draft without the weekly series still makes one page', async () => {
    const { totalPages, text } = await pages(payload({ series: undefined, products: undefined }));
    expect(totalPages).toBe(1);
    expect(text[0]).toContain('Penjualan per Minggu');
  });

  it('a store with no ads and no previous week still renders on one page', async () => {
    const quiet = normalizeRow('dashboard', { store: 'Toko Kecil', periodStart: '2026-11-09', sales: 5000000, orders: 20, traffic: 400 })!;
    const { totalPages } = await pages({ store: 'ProOne - Toko Kecil', client: '', from: '2026-11-09', to: '2026-11-15', cur: sumRows([quiet], '2026-11-09', '2026-11-15')!, prev: null, series: weeklySeries([quiet], '2026-11-09'), products: null });
    expect(totalPages).toBe(1);
  });
}, 60000);

describe('pdfText', () => {
  it('turns odd dashes and spaces into plain ones and drops what the PDF font cannot draw', () => {
    expect(pdfText('AC Panasonic 1 PK CS\u2011YU9BKJ AC Split')).toBe('AC Panasonic 1 PK CS-YU9BKJ AC Split');
    expect(pdfText('Toko\u00A0Maju\u2009Jaya \u2013 Cabang')).toBe('Toko Maju Jaya - Cabang');
    expect(pdfText('\u201CPromo\u201D \uD83D\uDD25 Roda\u200B Caster')).toBe('"Promo" Roda Caster');
    expect(pdfText('\u4E2D\u6587 Kawat')).toBe('Kawat');
    expect(pdfText('Pompa Mini  Ban\n 3"')).toBe('Pompa Mini Ban 3"');
  });
  it('keeps accented Latin letters', () => {
    expect(pdfText('Caf\u00E9 R\u00F6sti')).toBe('Caf\u00E9 R\u00F6sti');
  });
  it('a product name with a non-breaking hyphen and an emoji still makes a clean one-page PDF', async () => {
    const p = payload({ products: [{ name: 'AC Panasonic 1 PK CS\u2011YU9BKJ \uD83D\uDD25', sales: 21730228 }, { name: '   ', sales: 5 }] });
    const { totalPages, text } = await pages(p);
    expect(totalPages).toBe(1);
    expect(text[0]).toContain('AC Panasonic 1 PK CS-YU9BKJ');
    expect(text[0]).not.toContain('\u2011');
  });
});

describe('chart helpers', () => {
  it('the weekly charts share their columns: the same week is at the same x in both, so they can be read straight down', () => {
    const a = barColumns(5);
    const b = barColumns(5);
    expect(a.centers).toEqual(b.centers);
    expect(a.barWidth).toBe(b.barWidth);
    // 5 equal columns between the amount labels and the right edge, each bar centred in its column
    expect(a.slot).toBeCloseTo((CHART_W - CHART_LEFT) / 5, 6);
    expect(a.centers[0]).toBeCloseTo(CHART_LEFT + a.slot / 2, 6);
    expect(a.centers[4]).toBeCloseTo(CHART_W - a.slot / 2, 6);
    a.centers.forEach((c, i) => { if (i) expect(c - a.centers[i - 1]).toBeCloseTo(a.slot, 6); });
  });

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
