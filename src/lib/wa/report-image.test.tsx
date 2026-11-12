import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { normalizeRow } from '@/lib/integrations/performance';
import { sumRows, weeklySeries, type WeeklyPayload } from './weekly';
import { darkShare, IMAGE_SCALE, MIN_DARK_SHARE, pdfToJpeg, renderWeeklyJpeg } from './report-image';
import { renderWeeklyPdf } from './weekly-pdf';

const k = [0.82, 0.9, 1.0, 1.08, 1.2];
const adk = [0.95, 1.1, 0.9, 1.0, 1.25];
const starts = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'];
const rows = starts.map((d, i) => normalizeRow('dashboard', { store: 'onat.hardware', periodStart: d, periodEnd: d, granularity: 'week',
  sales: 108000000 * k[i], gmv: 125000000 * k[i], traffic: 13400 * k[i], addToCart: 41800 * k[i], orders: 1320 * k[i],
  ads: { total: { cost: 6180000 * k[i] * adk[i], sales: 97000000 * k[i] }, gmvMax: { cost: 710000 * k[i] * adk[i], sales: 16900000 * k[i] }, group: { cost: 3800000 * k[i] * adk[i], sales: 54700000 * k[i] }, independent: { cost: 1670000 * k[i] * adk[i], sales: 25500000 * k[i] } } })!);
const products = [['L3O Kawat Loket PVC RAM Ayakan 1/2 " ECO L30', 51601692], ['ONAT Roda Caster Nylon PU PVC Orange 3 Inch REM Medium Duty', 22578657], ['ONAT Cam Lock camlock Kunci Laci 103 - 20 mm Lemari ONAT', 17545450]].map(([name, sales]) => ({ name: name as string, sales: Math.round((sales as number) * 0.23) }));

const payload: WeeklyPayload = { store: 'ProOne - onat.hardware (CONTOH DATA)', client: 'Onat', from: '2026-11-09', to: '2026-11-15', cur: sumRows(rows, '2026-11-09', '2026-11-15')!, prev: sumRows(rows, '2026-11-02', '2026-11-08'), series: weeklySeries(rows, '2026-11-09'), products };

describe('weekly report as a JPG', () => {
  it('is a real JPG of one A4 page, readable size, with text and the coloured charts on it', async () => {
    const jpg = await renderWeeklyJpeg(payload);
    if (process.env.WA_SAMPLE_JPG) writeFileSync(process.env.WA_SAMPLE_JPG, jpg);

    // a JPEG file, not too big for WhatsApp (4 MB limit) and not empty
    expect(Buffer.from(jpg.subarray(0, 3)).toString('hex')).toBe('ffd8ff');
    expect(jpg.byteLength).toBeGreaterThan(30_000);
    expect(jpg.byteLength).toBeLessThan(1_500_000);

    // A4 (595 x 842 pt) at the chosen scale
    const img = await loadImage(Buffer.from(jpg));
    expect(Math.abs(img.width - 595.28 * IMAGE_SCALE)).toBeLessThanOrEqual(1);
    expect(Math.abs(img.height - 841.89 * IMAGE_SCALE)).toBeLessThanOrEqual(1);

    // look at the pixels: white page, dark text, blue sales bars, amber cost bars
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    let white = 0, dark = 0, blue = 0, amber = 0;
    const total = img.width * img.height;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 240 && g > 240 && b > 240) white++;
      else if (r < 90 && g < 90 && b < 90) dark++;
      if (b > 200 && r < 80 && g > 80 && g < 140) blue++;            // the report-week sales bar (#2563eb)
      if (r > 200 && g > 90 && g < 130 && b < 40) amber++;           // the report-week cost bar (#d97706)
    }
    expect(white / total).toBeGreaterThan(0.45);      // mostly white page ...
    expect(white / total).toBeLessThan(0.97);         // ... but not blank
    expect(dark / total).toBeGreaterThan(0.004);      // text is there
    expect(blue).toBeGreaterThan(300);
    expect(amber).toBeGreaterThan(300);
  }, 120000);

  it('the PDF embeds every font it uses (Roboto only): nothing relies on fonts installed on the server', async () => {
    const pdf = Buffer.from(await renderWeeklyPdf(payload)).toString('latin1');
    const names = Array.from(new Set((pdf.match(/\/BaseFont\s*\/[A-Za-z0-9+_-]+/g) || []).map((m) => m.replace(/\/BaseFont\s*\//, ''))));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n, `font ${n} is not an embedded Roboto subset`).toMatch(/Roboto/);
    expect(pdf).not.toMatch(/\/BaseFont\s*\/(Helvetica|Times|Courier|Arial)/);
  });

  it('drawing the page makes no font warnings (a warning here means the text depends on the host)', async () => {
    const warnings: string[] = [];
    const spyWarn = console.warn; const spyLog = console.log;
    console.warn = (...a: unknown[]) => { warnings.push(a.join(' ')); };
    console.log = (...a: unknown[]) => { warnings.push(a.join(' ')); };
    try { await renderWeeklyJpeg(payload); } finally { console.warn = spyWarn; console.log = spyLog; }
    const bad = warnings.filter((w) => /substitute the font|sumPrecise|standardFontDataUrl|Unable to load font|font/i.test(w));
    expect(bad).toEqual([]);
  }, 120000);

  it('refuses a picture without text: a blank page is never returned', async () => {
    expect(darkShare(new Uint8ClampedArray(4 * 1000).fill(255))).toBe(0);
    const dark = new Uint8ClampedArray(4 * 1000); for (let i = 0; i < dark.length; i += 4) dark[i + 3] = 255;
    expect(darkShare(dark)).toBe(1);
    expect(MIN_DARK_SHARE).toBeGreaterThan(0);
    // a PDF whose only content is a coloured box (no text) must be refused
    const { renderToBuffer, Document, Page, View } = await import('@react-pdf/renderer');
    const React = (await import('react')).default;
    const boxOnly = new Uint8Array(await renderToBuffer(React.createElement(Document, null, React.createElement(Page, { size: 'A4' }, React.createElement(View, { style: { width: 300, height: 200, backgroundColor: '#2563eb', margin: 40 } })))));
    await expect(pdfToJpeg(boxOnly)).rejects.toThrow(/no text/);
  }, 120000);
});
