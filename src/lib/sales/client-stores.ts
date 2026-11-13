// The stores of the clients (table client_stores): one client can have several. Server-side only.
type Db = any;

export const STORE_COMPANIES = ['ProOne', 'Reline', 'Alpha', 'Lighting Solution'] as const;
/** A store of a client. The last four are its own settings (null = the client's value). */
export interface ClientStoreRef { id: string; company: string; store: string; waGroupId?: string | null; startDate?: string | null; advertiserId?: string | null; adminId?: string | null }
export const storeText = (s: { company: string; store: string }) => `${s.company} - ${s.store}`;

/** "ProOne - japarutomo" -> { company, store }; anything else (no store part) -> null. */
export function parseStoreText(v?: string | null): { company: string; store: string } | null {
  const m = /^\s*(ProOne|Reline|Alpha|Lighting Solution)\s+-\s+(\S.*)$/i.exec(String(v || ''));
  if (!m) return null;
  return { company: STORE_COMPANIES.find((c) => c.toLowerCase() === m[1].toLowerCase()) || m[1], store: m[2].trim() };
}

/**
 * The stores of these clients (all clients when no ids). Before 20261106_client_stores.sql exists, the one store of each client
 * (clients.store_name) is read instead, so nothing disappears.
 */
export async function loadClientStores(db: Db, clientIds?: string[]): Promise<Map<string, ClientStoreRef[]>> {
  const out = new Map<string, ClientStoreRef[]>();
  const push = (clientId: string, ref: ClientStoreRef) => out.set(clientId, [...(out.get(clientId) || []), ref]);
  const chunks: string[][] = [];
  if (clientIds) for (let i = 0; i < clientIds.length; i += 200) chunks.push(clientIds.slice(i, i + 200)); else chunks.push([]);
  for (const ids of chunks) {
    const read = (cols: string) => {
      let q = db.from('client_stores').select(cols).order('created_at', { ascending: true }).limit(20000);
      if (clientIds) q = q.in('client_id', ids);
      return q;
    };
    let { data, error } = await read('id, client_id, company, store, wa_group_id, start_date, advertiser_id, admin_id');
    if (error) ({ data, error } = await read('id, client_id, company, store')); // before 20261116_store_level_settings.sql
    if (error) {
      // the table is not there yet: the store of the client itself
      let c = db.from('clients').select('id, store_name').not('store_name', 'is', null).limit(20000);
      if (clientIds) c = c.in('id', ids);
      const { data: legacy } = await c;
      for (const r of legacy || []) { const p = parseStoreText(r.store_name); if (p) push(r.id, { id: `legacy-${r.id}`, ...p }); }
      continue;
    }
    for (const r of data || []) push(r.client_id, { id: r.id, company: r.company, store: r.store, waGroupId: r.wa_group_id ?? null, startDate: r.start_date ?? null, advertiserId: r.advertiser_id ?? null, adminId: r.admin_id ?? null });
  }
  return out;
}

/** One line per store: the client and the "Company - Store" text. For the places that match a performance store to its client. */
export async function storeLinks(db: Db): Promise<Array<{ id: string; name: string; store_name: string }>> {
  const stores = await loadClientStores(db);
  if (!stores.size) return [];
  const ids = Array.from(stores.keys());
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('clients').select('id, name').in('id', ids.slice(i, i + 200));
    for (const c of data || []) names.set(c.id, c.name);
  }
  const out: Array<{ id: string; name: string; store_name: string }> = [];
  for (const [clientId, list] of stores) for (const s of list) out.push({ id: clientId, name: names.get(clientId) || '', store_name: storeText(s) });
  return out;
}
