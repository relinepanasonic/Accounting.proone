// Which advertiser handles which store. Server-side only.
// 1. By hand: a row of perf_store_advertiser (set in the Store Detail table).
// 2. Automatic: the Clients table has a store name per client and an advertiser assigned to that client (job "advertising"):
//    a performance store whose name equals the client's store name (or client name or brand) belongs to that advertiser.
type Db = any;

export interface AdvertiserPerson { id: string; name: string }

export interface StoreAdvertiserMap {
  advertisers: AdvertiserPerson[];
  /** Normalised client store / name / brand -> advertiser id. */
  byName: Map<string, string>;
  /** Store key -> advertiser id (by hand). */
  manual: Map<string, string>;
  manualReady: boolean;
}

/** "Toko Elektronik A." and "toko elektronik a" are the same store. */
export const nameKey = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function advertiserOf(map: StoreAdvertiserMap, storeKey: string, store: string): string | null {
  return map.manual.get(storeKey) || map.byName.get(nameKey(store)) || null;
}

export async function loadStoreAdvertisers(db: Db): Promise<StoreAdvertiserMap> {
  const { data: assignments } = await db.from('client_assignments').select('client_id, user_id').eq('job', 'advertising').limit(5000);
  const clientIds = Array.from(new Set((assignments || []).map((a: any) => a.client_id)));
  const clients: any[] = [];
  for (let i = 0; i < clientIds.length; i += 200) {
    const { data } = await db.from('clients').select('id, name, company_name, store_name').in('id', clientIds.slice(i, i + 200));
    clients.push(...(data || []));
  }

  const { data: manualRows, error: manualErr } = await db.from('perf_store_advertiser').select('store_key, advertiser_id').limit(5000);
  const manual = new Map<string, string>(manualErr ? [] : (manualRows || []).map((r: any) => [r.store_key, r.advertiser_id] as [string, string]));

  // The advertisers: everybody who has a client or a store.
  const userIds = Array.from(new Set([...(assignments || []).map((a: any) => a.user_id), ...manual.values()]));
  const { data: members } = await db.from('workspace_members').select('user_id').eq('role', 'advertiser');
  for (const m of members || []) if (!userIds.includes(m.user_id)) userIds.push(m.user_id);
  const { data: profiles } = userIds.length ? await db.from('profiles').select('id, full_name, email').in('id', userIds) : { data: [] as any[] };
  const advertisers: AdvertiserPerson[] = (profiles || [])
    .map((p: any) => ({ id: p.id as string, name: String(p.full_name || p.email?.split('@')[0] || 'Advertiser') }))
    .sort((a: AdvertiserPerson, b: AdvertiserPerson) => a.name.localeCompare(b.name));

  // Names -> advertiser; when a name has several advertisers the one with the most clients wins.
  const votes = new Map<string, Map<string, number>>();
  const clientById = new Map<string, any>(clients.map((c) => [c.id, c]));
  for (const a of assignments || []) {
    const c = clientById.get(a.client_id);
    if (!c) continue;
    for (const raw of [c.store_name, c.company_name, c.name]) {
      const k = nameKey(raw);
      if (!k) continue;
      const v = votes.get(k) || new Map<string, number>();
      v.set(a.user_id, (v.get(a.user_id) || 0) + 1);
      votes.set(k, v);
    }
  }
  const byName = new Map<string, string>();
  for (const [k, v] of votes) byName.set(k, Array.from(v.entries()).sort((x, y) => y[1] - x[1])[0][0]);

  return { advertisers, byName, manual, manualReady: !manualErr };
}
