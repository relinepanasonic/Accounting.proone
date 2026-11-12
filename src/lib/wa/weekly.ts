import { addRow, emptyTotals, type PerfRow, type PerfTotals } from '@/lib/integrations/performance';

/**
 * The weekly report Oli sends to a client's WhatsApp group: a formal title ("Weekly Report 2 - 8 Nov 2026"), the store, and a 2-page PDF.
 * Without the PDF (file sending off), the same key numbers are sent as text. Pure: rows in, text out.
 * Numbers come from the store performance feed of Dashboard Prof / Reline (the same one as the Advertiser dashboard):
 * a row belongs to a week when its period STARTS inside that Monday-to-Sunday week, exactly as the ERP's own charts count it.
 * The headline figures follow the monthly report of Dashboard Prof: Penjualan (ready to ship), Traffic, Biaya Iklan, and
 * ROAS = Penjualan / Biaya Iklan.
 */

import { publicStoreName } from './public-name';

const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

export interface WeekRanges { from: string; to: string; prevFrom: string; prevTo: string }

/** The last full Monday-to-Sunday week before `today` (a Jakarta day), and the week before it. Run on a Monday it gives the week that just ended. */
export function lastFullWeek(today: string): WeekRanges {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();          // 0 = Sunday
  const mondayThis = addDays(today, -((dow + 6) % 7));
  const from = addDays(mondayThis, -7);
  return { from, to: addDays(mondayThis, -1), prevFrom: addDays(from, -7), prevTo: addDays(from, -1) };
}

/** How many weeks the chart shows: this week and the 4 before it. */
export const CHART_WEEKS = 5;

/** The first day the feed must be asked for so the chart has its 4 earlier weeks. */
export const seriesFrom = (weekFrom: string) => addDays(weekFrom, -7 * (CHART_WEEKS - 1));

/** Adds up the rows whose period starts in [from, to]. Null when the store has no row there. */
export function sumRows(rows: PerfRow[], from: string, to: string): PerfTotals | null {
  const t = emptyTotals();
  let n = 0;
  for (const r of rows) if (r.periodStart >= from && r.periodStart <= to) { addRow(t, r); n++; }
  return n ? t : null;
}

/** Real numbers for the week: any sales, orders, traffic or ad spend. */
export const hasActivity = (t: PerfTotals | null) => !!t && (t.sales > 0 || t.gmv > 0 || t.orders > 0 || t.traffic > 0 || t.ads.total.cost > 0);

/** ROAS as the monthly report counts it: Penjualan / Biaya Iklan. */
export const roasOf = (t: PerfTotals | null | undefined) => (t && t.ads.total.cost > 0 ? t.sales / t.ads.total.cost : 0);
/** Share of visitors who ordered. */
export const cvrOf = (t: PerfTotals | null | undefined) => (t && t.traffic > 0 ? (t.orders / t.traffic) * 100 : 0);

export interface WeekPoint { from: string; to: string; sales: number; adCost: number; adSales: number; orders: number; traffic: number }

/** One point per week, oldest first, the last one being the report week. A week without rows is all zeros (it still shows on the chart). */
export function weeklySeries(rows: PerfRow[], weekFrom: string, weeks = CHART_WEEKS): WeekPoint[] {
  const out: WeekPoint[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const from = addDays(weekFrom, -7 * k);
    const to = addDays(from, 6);
    const t = sumRows(rows, from, to);
    out.push({ from, to, sales: t?.sales || 0, adCost: t?.ads.total.cost || 0, adSales: t?.ads.total.sales || 0, orders: t?.orders || 0, traffic: t?.traffic || 0 });
  }
  return out;
}

export const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
export const int = (n: number) => Math.round(n).toLocaleString('id-ID');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const day = (d: string) => String(Number(d.slice(8, 10)));
const mon = (d: string) => MONTHS[Number(d.slice(5, 7)) - 1];

/** "2 - 8 Nov 2026", "28 Okt - 3 Nov 2026", or with both years when the week crosses New Year. */
export function periodText(from: string, to: string): string {
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${day(from)} ${mon(from)} ${from.slice(0, 4)} - ${day(to)} ${mon(to)} ${to.slice(0, 4)}`;
  if (from.slice(5, 7) !== to.slice(5, 7)) return `${day(from)} ${mon(from)} - ${day(to)} ${mon(to)} ${to.slice(0, 4)}`;
  return `${day(from)} - ${day(to)} ${mon(to)} ${to.slice(0, 4)}`;
}

/** The short label under a chart bar: "2-8 Nov" / "26 Okt-1 Nov". */
export function weekLabel(from: string, to: string): string {
  return from.slice(5, 7) === to.slice(5, 7) ? `${day(from)}-${day(to)} ${mon(to)}` : `${day(from)} ${mon(from)}-${day(to)} ${mon(to)}`;
}

/** The formal title of the report and the store it is about: this is also the caption of the PDF. */
export function weeklyCaption(o: { store: string; client?: string; from: string; to: string }): string {
  const store = publicStoreName(o.store);           // the company (ProOne, Reline...) is not for the client
  const who = o.client && o.client.toLowerCase() !== store.toLowerCase() ? `${store} (${o.client})` : store;
  return `*Weekly Report* ${periodText(o.from, o.to)}\n${who}`;
}

/** The file name of the PDF: "Weekly Report 2-8 Nov 2026 - ProOne - Toko A.pdf" (no characters a file name cannot hold). */
export function weeklyFileName(store: string, from: string, to: string): string {
  const safe = publicStoreName(store).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Store';
  return `Weekly Report ${periodText(from, to).replace(/ - /, '-')} - ${safe}.pdf`;
}

/** "naik 12%" / "turun 5%" / "sama seperti minggu lalu"; empty when last week has nothing to compare with. */
export function changeText(now: number, before: number | null | undefined): string {
  if (!before || before <= 0) return '';
  const p = ((now - before) / before) * 100;
  if (Math.abs(p) < 0.5) return ' (sama seperti minggu lalu)';
  return ` (${p > 0 ? 'naik' : 'turun'} ${Math.abs(p) >= 10 ? Math.round(Math.abs(p)) : (Math.round(Math.abs(p) * 10) / 10).toString().replace('.', ',')}% dari minggu lalu)`;
}

export const roasText = (sales: number, cost: number) => (cost > 0 ? `${(Math.round((sales / cost) * 10) / 10).toString().replace('.', ',')}x` : '-');

/** The key numbers as text lines (used when the PDF cannot be attached). */
export function weeklyFigures(cur: PerfTotals, prev: PerfTotals | null): string {
  const out: string[] = [];
  out.push(`Penjualan: ${rp(cur.sales)}${changeText(cur.sales, prev?.sales)}`);
  if (cur.orders > 0 || prev?.orders) out.push(`Pesanan: ${int(cur.orders)}${changeText(cur.orders, prev?.orders)}`);
  if (cur.traffic > 0) out.push(`Pengunjung: ${int(cur.traffic)}${changeText(cur.traffic, prev?.traffic)}`);

  const a = cur.ads.total;
  if (a.cost > 0) {
    out.push('');
    out.push(`Biaya Iklan: ${rp(a.cost)}${changeText(a.cost, prev?.ads.total.cost)}`);
    const before = prev && prev.ads.total.cost > 0 ? `, minggu lalu ${roasText(prev.sales, prev.ads.total.cost)}` : '';
    out.push(`ROAS (Penjualan / Biaya Iklan): ${roasText(cur.sales, a.cost)}${before}`);

    const parts: Array<[string, typeof a]> = [['GMV Max Auto', cur.ads.gmvMax], ['Iklan Grup', cur.ads.group], ['Iklan Mandiri', cur.ads.independent]];
    const lines = parts.filter(([, x]) => x.cost > 0 || x.sales > 0).map(([name, x]) => `- ${name}: biaya ${rp(x.cost)}, penjualan ${rp(x.sales)}, ROAS ${roasText(x.sales, x.cost)}`);
    if (lines.length > 1) out.push('', 'Rincian iklan:', ...lines);
  }
  return out.join('\n');
}

/** The whole text message: title, store, then the numbers. No greeting and no sign-off. */
export function weeklyMessage(o: { client: string; store: string; from: string; to: string; cur: PerfTotals; prev: PerfTotals | null }): string {
  return `${weeklyCaption(o)}\n\n${weeklyFigures(o.cur, o.prev)}`;
}

export interface TopProduct { name: string; sales: number }

/** What is saved with a draft, so the PDF is drawn from exactly the numbers the admin saw. */
export interface WeeklyPayload {
  store: string;
  client: string;
  from: string;
  to: string;
  cur: PerfTotals;
  prev: PerfTotals | null;
  /** This week and the 4 before it, oldest first (older drafts do not have it). */
  series?: WeekPoint[];
  /** The 10 best-selling products of the week; null / missing when the app does not send product data yet. */
  products?: TopProduct[] | null;
}
