// Store performance from the two apps (Profesor Dashboard: per store; Reline: per dealer), for the Advertiser Dashboard.
// Endpoint (owned by each app): GET <base>/api/erp/performance?from=YYYY-MM-DD&to=YYYY-MM-DD, Bearer key. Contract: PERFORMANCE_API_PROMPT.md.
// The fetch is server-side only; the aggregation below is pure (also used by the tests).

export type PerfSource = 'dashboard' | 'reline';

export interface PerfAds {
  cost: number;
  sales: number;
  views: number;
  clicks: number;
  addToCart: number;
  orders: number;
  itemsSold: number;
}

export interface PerfRow {
  source: PerfSource;
  /** Store name (Profesor Dashboard) or dealer name (Reline). */
  store: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  granularity: 'day' | 'week' | 'month';
  /** Panasonic (ready to ship) sales of the store. */
  sales: number;
  /** All brands. */
  gmv: number;
  traffic: number;
  addToCart: number;
  orders: number;
  itemsSold: number;
  productViews: number;
  productClicks: number;
  baselineSales: number;
  activeSales: number;
  ads: { gmvMax: PerfAds; group: PerfAds; independent: PerfAds };
}

export type PerfResult = { ok: true; rows: PerfRow[] } | { ok: false; error: string };

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const emptyAds = (): PerfAds => ({ cost: 0, sales: 0, views: 0, clicks: 0, addToCart: 0, orders: 0, itemsSold: 0 });
const ads = (v: any): PerfAds => ({
  cost: num(v?.cost), sales: num(v?.sales), views: num(v?.views), clicks: num(v?.clicks),
  addToCart: num(v?.addToCart), orders: num(v?.orders), itemsSold: num(v?.itemsSold),
});

/** One row of the endpoint, made safe (missing numbers are 0). */
export function normalizeRow(source: PerfSource, r: any): PerfRow | null {
  const store = String(r?.store || r?.dealer || '').trim();
  const periodStart = String(r?.periodStart || '').slice(0, 10);
  if (!store || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) return null;
  return {
    source,
    store,
    periodStart,
    periodEnd: String(r?.periodEnd || periodStart).slice(0, 10),
    granularity: r?.granularity === 'day' || r?.granularity === 'month' ? r.granularity : 'week',
    sales: num(r?.sales), gmv: num(r?.gmv), traffic: num(r?.traffic), addToCart: num(r?.addToCart),
    orders: num(r?.orders), itemsSold: num(r?.itemsSold), productViews: num(r?.productViews), productClicks: num(r?.productClicks),
    baselineSales: num(r?.baselineSales), activeSales: num(r?.activeSales),
    ads: { gmvMax: ads(r?.ads?.gmvMax), group: ads(r?.ads?.group), independent: ads(r?.ads?.independent) },
  };
}

export async function fetchPerformance(source: PerfSource, from: string, to: string): Promise<PerfResult> {
  const keyName = source === 'dashboard' ? 'DASHBOARD_API_KEY' : 'RELINE_API_KEY';
  const key = source === 'dashboard' ? process.env.DASHBOARD_API_KEY : process.env.RELINE_API_KEY;
  const base = (source === 'dashboard' ? process.env.DASHBOARD_API_URL || 'https://dashboard.profesoronline.id' : process.env.RELINE_API_URL || 'https://reline.profesoronline.id').replace(/\/$/, '');
  if (!key) return { ok: false, error: `${keyName} is not set.` };
  try {
    const res = await fetch(`${base}/api/erp/performance?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      next: { revalidate: 300 },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 404 || (res.status >= 300 && res.status < 400)) return { ok: false, error: 'The performance endpoint is not built yet in this app (see PERFORMANCE_API_PROMPT.md).' };
    if (res.status === 401) return { ok: false, error: `The app refused the key (401): ${keyName} here must equal ERP_API_KEY there.` };
    if (!res.ok) return { ok: false, error: `The app answered ${res.status}.` };
    const json = await res.json();
    const rows = (Array.isArray(json?.rows) ? json.rows : []).map((r: any) => normalizeRow(source, r)).filter(Boolean) as PerfRow[];
    return { ok: true, rows };
  } catch (err: any) {
    return { ok: false, error: err?.name === 'TimeoutError' ? 'The app timed out.' : 'Could not reach the app.' };
  }
}

// ---------------------------------------------------------------- aggregation

export interface PerfTotals {
  sales: number; gmv: number; traffic: number; addToCart: number; orders: number; itemsSold: number;
  productViews: number; productClicks: number; baselineSales: number; activeSales: number;
  ads: { gmvMax: PerfAds; group: PerfAds; independent: PerfAds };
}

export const emptyTotals = (): PerfTotals => ({
  sales: 0, gmv: 0, traffic: 0, addToCart: 0, orders: 0, itemsSold: 0, productViews: 0, productClicks: 0, baselineSales: 0, activeSales: 0,
  ads: { gmvMax: emptyAds(), group: emptyAds(), independent: emptyAds() },
});

export function addRow(t: PerfTotals, r: PerfRow) {
  t.sales += r.sales; t.gmv += r.gmv; t.traffic += r.traffic; t.addToCart += r.addToCart; t.orders += r.orders; t.itemsSold += r.itemsSold;
  t.productViews += r.productViews; t.productClicks += r.productClicks; t.baselineSales += r.baselineSales; t.activeSales += r.activeSales;
  for (const k of ['gmvMax', 'group', 'independent'] as const) {
    const a = t.ads[k]; const b = r.ads[k];
    a.cost += b.cost; a.sales += b.sales; a.views += b.views; a.clicks += b.clicks; a.addToCart += b.addToCart; a.orders += b.orders; a.itemsSold += b.itemsSold;
  }
}

export const adsCost = (t: PerfTotals) => t.ads.gmvMax.cost + t.ads.group.cost + t.ads.independent.cost;
export const adsSales = (t: PerfTotals) => t.ads.gmvMax.sales + t.ads.group.sales + t.ads.independent.sales;
export const roas = (sales: number, cost: number) => (cost > 0 ? sales / cost : 0);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Which bucket a row goes to: the month of the year, or the week of the chosen month (1-7, 8-14, ...). -1 = outside the period. */
export function bucketOf(periodStart: string, year: number, month: number): number {
  if (Number(periodStart.slice(0, 4)) !== year) return -1;
  const m = Number(periodStart.slice(5, 7));
  if (!month) return m - 1;
  if (m !== month) return -1;
  return Math.min(4, Math.floor((Number(periodStart.slice(8, 10)) - 1) / 7));
}

export const bucketLabels = (month: number) => (month ? ['W1', 'W2', 'W3', 'W4', 'W5'] : MONTHS);

export interface PerfView {
  labels: string[];
  totals: PerfTotals;
  buckets: PerfTotals[];
  stores: Array<{ key: string; source: PerfSource; store: string; totals: PerfTotals; series: number[] }>;
}

/** The numbers of the dashboard for one year (or one month) and one store ('' = all). The store key is "<source>:<name>". */
export function buildView(rows: PerfRow[], year: number, month: number, storeKey: string): PerfView {
  const labels = bucketLabels(month);
  const totals = emptyTotals();
  const buckets = labels.map(() => emptyTotals());
  const byStore = new Map<string, { source: PerfSource; store: string; totals: PerfTotals; series: number[] }>();
  for (const r of rows) {
    const b = bucketOf(r.periodStart, year, month);
    if (b < 0) continue;
    const key = `${r.source}:${r.store}`;
    const s = byStore.get(key) || { source: r.source, store: r.store, totals: emptyTotals(), series: labels.map(() => 0) };
    addRow(s.totals, r);
    s.series[b] += r.sales;
    byStore.set(key, s);
    if (storeKey && key !== storeKey) continue;
    addRow(totals, r);
    addRow(buckets[b], r);
  }
  const stores = Array.from(byStore.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.totals.sales - a.totals.sales);
  return { labels, totals, buckets, stores };
}
