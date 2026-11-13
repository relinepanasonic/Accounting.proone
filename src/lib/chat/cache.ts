/**
 * A tiny in-memory cache for the chat API. A Vercel function instance stays warm for minutes and serves many requests, so the things that
 * hardly ever change (who a token belongs to, which number is the sales device, the client phone list) are read from the database once
 * and reused for a short time. Concurrent requests for the same key share ONE load. Per instance only: nothing here is shared or stored.
 */

interface Entry<T> { at: number; value?: T; pending?: Promise<T> }
const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 500;

export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit) {
    if (hit.pending) return hit.pending;
    if (now() - hit.at < ttlMs) return hit.value as T;
  }
  const pending = load().then(
    (value) => { store.set(key, { at: now(), value }); return value; },
    (err) => { store.delete(key); throw err; },            // a failed load is never kept
  );
  store.set(key, { at: now(), pending });
  if (store.size > MAX_ENTRIES) {                              // drop the oldest entries
    for (const k of [...store.keys()].slice(0, store.size - MAX_ENTRIES)) store.delete(k);
  }
  return pending;
}

export const forget = (prefix: string) => { for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k); };
export const clearCache = () => store.clear();
