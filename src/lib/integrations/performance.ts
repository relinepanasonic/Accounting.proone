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
  /** Reline workspace of the row (the same store name can exist in two workspaces); empty for Profesor Dashboard. */
  workspace: string;
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
  /** total = all ads of the store (Profesor Dashboard sends it; for Reline it is the sum of the three types). */
  ads: { total: PerfAds; gmvMax: PerfAds; group: PerfAds; independent: PerfAds };
}

export type PerfResult = { ok: true; rows: PerfRow[] } | { ok: false; error: string };

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const emptyAds = (): PerfAds => ({ cost: 0, sales: 0, views: 0, clicks: 0, addToCart: 0, orders: 0, itemsSold: 0 });
const ads = (v: any): PerfAds => ({
  cost: num(v?.cost), sales: num(v?.sales), views: num(v?.views), clicks: num(v?.clicks),
  addToCart: num(v?.addToCart), orders: num(v?.orders), itemsSold: num(v?.itemsSold),
});

/**
 * The ads of a row. The "total" block is the whole of the store's ads (use it for cost, sales and add to cart: the three types do not add up to
 * it for add to cart, and Independent is "total minus the others"). A feed without "total" (Reline) gets the sum of the three types.
 */
function withTotal(a: any) {
  const gmvMax = ads(a?.gmvMax); const group = ads(a?.group); const independent = ads(a?.independent);
  const sum = [gmvMax, group, independent].reduce((t, x) => ({
    cost: t.cost + x.cost, sales: t.sales + x.sales, views: t.views + x.views, clicks: t.clicks + x.clicks,
    addToCart: t.addToCart + x.addToCart, orders: t.orders + x.orders, itemsSold: t.itemsSold + x.itemsSold,
  }), emptyAds());
  return { total: a?.total ? ads(a.total) : sum, gmvMax, group, independent };
}

/** One row of the endpoint, made safe (missing numbers are 0). */
export function normalizeRow(source: PerfSource, r: any): PerfRow | null {
  const store = String(r?.store || r?.dealer || '').trim();
  const periodStart = String(r?.periodStart || '').slice(0, 10);
  if (!store || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) return null;
  return {
    source,
    store,
    workspace: String(r?.workspace || '').trim(),
    periodStart,
    periodEnd: String(r?.periodEnd || periodStart).slice(0, 10),
    granularity: r?.granularity === 'day' || r?.granularity === 'month' ? r.granularity : 'week',
    sales: num(r?.sales), gmv: num(r?.gmv), traffic: num(r?.traffic), addToCart: num(r?.addToCart),
    orders: num(r?.orders), itemsSold: num(r?.itemsSold), productViews: num(r?.productViews), productClicks: num(r?.productClicks),
    baselineSales: num(r?.baselineSales), activeSales: num(r?.activeSales),
    ads: withTotal(r?.ads),
  };
}

/**
 * The workspace of a store as the ERP names it: everything from Profesor Dashboard is ProOne (the company); Reline has three workspaces.
 * A store is written "<Workspace> - <Store>", for example "ProOne - Toko A" or "Alpha - Dealer X".
 */
export const WORKSPACE_LABELS = ['ProOne', 'Reline', 'Alpha', 'Lighting Solution'] as const;
export function workspaceLabel(source: PerfSource, workspace: string): string {
  if (source === 'dashboard') return 'ProOne';
  if (/alpha/i.test(workspace)) return 'Alpha';
  if (/light/i.test(workspace)) return 'Lighting Solution';
  return 'Reline';
}
export const storeLabel = (r: Pick<PerfRow, 'source' | 'store' | 'workspace'>) => `${workspaceLabel(r.source, r.workspace)} - ${r.store}`;

export async function fetchPerformance(source: PerfSource, from: string, to: string, timeoutMs = 55000): Promise<PerfResult> {
  const keyName = source === 'dashboard' ? 'DASHBOARD_API_KEY' : 'RELINE_API_KEY';
  const key = source === 'dashboard' ? process.env.DASHBOARD_API_KEY : process.env.RELINE_API_KEY;
  const base = (source === 'dashboard' ? process.env.DASHBOARD_API_URL || 'https://dashboard.profesoronline.id' : process.env.RELINE_API_URL || 'https://reline.profesoronline.id').replace(/\/$/, '');
  if (!key) return { ok: false, error: `${keyName} is not set.` };
  try {
    const res = await fetch(`${base}/api/erp/performance?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      next: { revalidate: 300 },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs), // the first call after an upload takes about 30 seconds (the app rebuilds its weekly cache)
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
  ads: { total: PerfAds; gmvMax: PerfAds; group: PerfAds; independent: PerfAds };
}

export const emptyTotals = (): PerfTotals => ({
  sales: 0, gmv: 0, traffic: 0, addToCart: 0, orders: 0, itemsSold: 0, productViews: 0, productClicks: 0, baselineSales: 0, activeSales: 0,
  ads: { total: emptyAds(), gmvMax: emptyAds(), group: emptyAds(), independent: emptyAds() },
});

/** baselineSales is one number per store (month-start Panasonic sales), repeated on each of its rows: it is NOT added up here (see buildView). */
export function addRow(t: PerfTotals, r: PerfRow) {
  t.sales += r.sales; t.gmv += r.gmv; t.traffic += r.traffic; t.addToCart += r.addToCart; t.orders += r.orders; t.itemsSold += r.itemsSold;
  t.productViews += r.productViews; t.productClicks += r.productClicks; t.activeSales += r.activeSales;
  for (const k of ['total', 'gmvMax', 'group', 'independent'] as const) {
    const a = t.ads[k]; const b = r.ads[k];
    a.cost += b.cost; a.sales += b.sales; a.views += b.views; a.clicks += b.clicks; a.addToCart += b.addToCart; a.orders += b.orders; a.itemsSold += b.itemsSold;
  }
}

export const adsCost = (t: PerfTotals) => t.ads.total.cost;
export const adsSales = (t: PerfTotals) => t.ads.total.sales;
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
  stores: Array<{ key: string; source: PerfSource; store: string; workspace: string; label: string; totals: PerfTotals; series: number[] }>;
}

/** The numbers of the dashboard for one year (or one month) and one store ('' = all). The store key is "<source>:<name>". */
export const storeKeyOf = (r: Pick<PerfRow, 'source' | 'store' | 'workspace'>) => `${r.source}:${r.store}${r.workspace ? `|${r.workspace}` : ''}`;

export function buildView(rows: PerfRow[], year: number, month: number, storeKey: string): PerfView {
  const labels = bucketLabels(month);
  const totals = emptyTotals();
  const buckets = labels.map(() => emptyTotals());
  const byStore = new Map<string, { source: PerfSource; store: string; workspace: string; label: string; totals: PerfTotals; series: number[] }>();
  // Baseline: the biggest value of each store (counted once per store, per bucket and for the whole period).
  const baseTotal = new Map<string, number>();
  for (const r of rows) {
    const b = bucketOf(r.periodStart, year, month);
    if (b < 0) continue;
    const key = storeKeyOf(r);
    const s = byStore.get(key) || { source: r.source, store: r.store, workspace: r.workspace, label: storeLabel(r), totals: emptyTotals(), series: labels.map(() => 0) };
    addRow(s.totals, r);
    s.series[b] += r.sales;
    byStore.set(key, s);
    s.totals.baselineSales = Math.max(s.totals.baselineSales, r.baselineSales);
    if (storeKey && key !== storeKey) continue;
    addRow(totals, r);
    addRow(buckets[b], r);
    baseTotal.set(key, Math.max(baseTotal.get(key) || 0, r.baselineSales));
  }
  const sum = (m: Map<string, number>) => Array.from(m.values()).reduce((a, v) => a + v, 0);
  totals.baselineSales = sum(baseTotal);
  // The baseline is a snapshot of the store (it comes once per store): a flat reference line over the buckets. In the week view it is a quarter of it.
  buckets.forEach((b) => { b.baselineSales = totals.baselineSales / (month ? 4 : 1); });
  // Active sales: the app's own number when it sends one, else the sales.
  if (totals.activeSales === 0) { totals.activeSales = totals.sales; buckets.forEach((b) => { b.activeSales = b.sales; }); }
  const stores = Array.from(byStore.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.totals.sales - a.totals.sales);
  return { labels, totals, buckets, stores };
}
