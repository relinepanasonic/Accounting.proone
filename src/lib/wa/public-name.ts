/**
 * A store as a CLIENT may see it. Internally a store is written "<Company> - <Store>" ("ProOne - onat.hardware", "Reline - Dealer X"): the company
 * is our own business and the client does not need to know it. Reports that go to a client show only the store name. (The full label stays in
 * the data: it is how stores are matched and linked.) Pure, no imports, so it can also run in the browser.
 */
const COMPANY_PREFIX = /^\s*(ProOne|Pro One|Reline|Alpha|Lighting Solution|PLIG|New Wave|NW|DOA|Dream of AI)\s*[-\u2013\u2014:]\s*/i;

export function publicStoreName(label: string | null | undefined): string {
  const full = String(label ?? '').trim();
  const bare = full.replace(COMPANY_PREFIX, '').trim();
  return bare || full;
}
