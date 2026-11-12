// The best-selling products of each store in a period, from the two apps (Profesor Dashboard: per store; Reline: per dealer).
// Endpoint (owned by each app): GET <base>/api/erp/top-products?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10, Bearer key. Contract: TOP_PRODUCTS_API_PROMPT.md.
// Used by the weekly client report (page 2). The fetch is server-side only; the normalising below is pure (also used by the tests).
import type { PerfSource } from './performance';

export interface ProductRow { name: string; sales: number }
export interface StoreProducts { source: PerfSource; store: string; workspace: string; products: ProductRow[] }
export type ProductsResult = { ok: true; stores: StoreProducts[] } | { ok: false; error: string };

const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

/** Same key as storeKeyOf() in performance.ts: "<source>:<store>|<workspace>". */
export const productsKey = (r: Pick<StoreProducts, 'source' | 'store' | 'workspace'>) => `${r.source}:${r.store}${r.workspace ? `|${r.workspace}` : ''}`;

/** One store of the response, made safe: products sorted by sales (best first), unnamed or zero-sales products dropped, at most `limit`. */
export function normalizeStoreProducts(source: PerfSource, s: any, limit = 10): StoreProducts | null {
  const store = String(s?.store || s?.dealer || '').trim();
  if (!store) return null;
  const products = (Array.isArray(s?.products) ? s.products : [])
    .map((p: any) => ({ name: String(p?.name || p?.product || '').replace(/\s+/g, ' ').trim(), sales: num(p?.sales) }))
    .filter((p: ProductRow) => p.name && p.sales > 0)
    .sort((a: ProductRow, b: ProductRow) => b.sales - a.sales)
    .slice(0, limit);
  return { source, store, workspace: String(s?.workspace || '').trim(), products };
}

export async function fetchTopProducts(source: PerfSource, from: string, to: string, timeoutMs = 45000): Promise<ProductsResult> {
  const keyName = source === 'dashboard' ? 'DASHBOARD_API_KEY' : 'RELINE_API_KEY';
  const key = source === 'dashboard' ? process.env.DASHBOARD_API_KEY : process.env.RELINE_API_KEY;
  const base = (source === 'dashboard' ? process.env.DASHBOARD_API_URL || 'https://dashboard.profesoronline.id' : process.env.RELINE_API_URL || 'https://reline.profesoronline.id').replace(/\/$/, '');
  if (!key) return { ok: false, error: `${keyName} is not set.` };
  try {
    const res = await fetch(`${base}/api/erp/top-products?from=${from}&to=${to}&limit=10`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      next: { revalidate: 300 },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 404 || (res.status >= 300 && res.status < 400)) return { ok: false, error: 'The top-products endpoint is not built yet in this app (see TOP_PRODUCTS_API_PROMPT.md).' };
    if (res.status === 401) return { ok: false, error: `The app refused the key (401): ${keyName} here must equal ERP_API_KEY there.` };
    if (!res.ok) return { ok: false, error: `The app answered ${res.status}.` };
    const json = await res.json();
    const stores = (Array.isArray(json?.stores) ? json.stores : []).map((s: any) => normalizeStoreProducts(source, s)).filter(Boolean) as StoreProducts[];
    return { ok: true, stores };
  } catch (err: any) {
    return { ok: false, error: err?.name === 'TimeoutError' ? 'The app timed out.' : 'Could not reach the app.' };
  }
}
