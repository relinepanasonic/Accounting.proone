// Clients that a salesman entered but that have no invoice request yet are "prospects": Accounting does not see
// them in client lists. Pure helper, safe for any server file.

/**
 * Runs a client query twice at most: first hiding prospects, and if the database has no `is_prospect` column yet
 * (migration not run), once more without the filter, so a missing migration never empties a client list.
 * `build(hide)` must create a FRESH query each time (query builders are single-use).
 */
export async function withoutProspects<T = any[]>(
  build: (hide: boolean) => PromiseLike<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const first = await build(true);
  if (first.error && (first.error.code === '42703' || /is_prospect/.test(first.error.message || ''))) return build(false);
  return first;
}
