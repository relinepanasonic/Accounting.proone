/**
 * Which WhatsApp group a store's report goes to. Pure.
 * A client has ONE group for all its brands and stores (clients.wa_group_id); a store can also be linked to a group by hand,
 * which wins. A client is found by name: a name shared by two clients with different groups is never guessed.
 */

/** Same as nameKey() in lib/integrations/store-advertiser.ts: "Toko Elektronik A." and "toko elektronik a" are the same name. */
export const nameKey = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function pickGroup(storeLabelText: string, clientName: string, byStore: Map<string, string>, byClient: Map<string, string | null>): string | null {
  return byStore.get(storeLabelText) || (clientName ? byClient.get(nameKey(clientName)) || null : null);
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
