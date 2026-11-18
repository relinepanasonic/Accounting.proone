/**
 * Which WhatsApp group a store's report goes to. Pure.
 * A client has ONE group for all its brands and stores (clients.wa_group_id); a store can also be linked to a group by hand,
 * which wins. A client is found by name: a name shared by two clients with different groups is never guessed.
 */

/** Same as nameKey() in lib/integrations/store-advertiser.ts: "Toko Elektronik A." and "toko elektronik a" are the same name. */
export const nameKey = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function pickGroup(storeLabelText: string, clientName: string, byStore: Map<string, string>, byClient: Map<string, string | null>): string | null {
  const direct = byStore.get(storeLabelText) || (clientName ? byClient.get(nameKey(clientName)) || null : null);
  if (direct || clientName) return direct;
  return looseGroupByStore(storeLabelText, byClient);
}

/**
 * A store that is not linked to any client yet ("Reline - Angkasa Jaya Elektronik" while the client is "ANGKASA JAYA"): its name contains the
 * name of exactly one client that has a group (or all the clients it matches share one group). Names under 5 letters never match.
 */
export function looseGroupByStore(storeLabelText: string, byClient: Map<string, string | null>): string | null {
  const store = nameKey(String(storeLabelText || '').replace(/^s*(ProOne|Reline|Alpha|Lighting Solution)s*-s*/i, ''));
  if (store.length < 5) return null;
  const groups = new Set<string>();
  for (const [k, g] of byClient) {
    if (k.length < 5 || !g) continue;
    if (store === k || store.includes(k)) groups.add(g);
  }
  return groups.size === 1 ? Array.from(groups)[0] : null;
}

/** Client name key -> its group; null when two clients with that name have different groups (ambiguous). */
export function clientGroupMap(clients: Array<{ name?: string | null; company_name?: string | null; wa_group_id?: string | null }>): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const c of clients) {
    if (!c.wa_group_id) continue;
    for (const k of new Set([nameKey(c.name || ''), nameKey(c.company_name || '')].filter(Boolean))) {
      m.set(k, m.has(k) && m.get(k) !== c.wa_group_id ? null : c.wa_group_id);
    }
  }
  return m;
}
