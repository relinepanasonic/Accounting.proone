// Which advertiser, admin and salesman handle which store. Server-side only.
// The Clients table links a client to a store ("ProOne - Toko A", "Alpha - Dealer X": workspace - store) and holds the advertiser, the admin
// and (through the client's invoices) the salesman of that client. So a performance store belongs to the team of the client linked to it.
// An advertiser can also be set by hand for a store (table perf_store_advertiser), which wins over the client link.
type Db = any;

export interface AdvertiserPerson { id: string; name: string }
export interface StoreTeam { advertiserId: string | null; adminId: string | null; sales: string }

export interface StoreAdvertiserMap {
  advertisers: AdvertiserPerson[];
  /** Every person with a name (advertisers, admins). */
  people: Map<string, string>;
  /** Normalised client store / name / brand -> its team. */
  byName: Map<string, StoreTeam>;
  /** Store key -> advertiser id (by hand). */
  manual: Map<string, string>;
  manualReady: boolean;
}

/** "Toko Elektronik A." and "toko elektronik a" are the same store. */
export const nameKey = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** "ProOne - Toko A" -> "tokoa" (the store without its workspace); a name without a workspace stays as it is. */
export function withoutWorkspace(s: string): string {
  const m = /^\s*(ProOne|Reline|Alpha|Lighting Solution)\s+-\s+(.+)$/i.exec(String(s || ''));
  return m ? nameKey(m[2]) : '';
}

/** The team of a store: the client linked to "<workspace> - <store>" first, then a client whose store name is just the store. */
export function teamOf(map: StoreAdvertiserMap, storeKey: string, label: string, store: string): StoreTeam {
  const t = map.byName.get(nameKey(label)) || map.byName.get(nameKey(store)) || { advertiserId: null, adminId: null, sales: '' };
  return { ...t, advertiserId: map.manual.get(storeKey) || t.advertiserId };
}

export const advertiserOf = (map: StoreAdvertiserMap, storeKey: string, label: string, store: string) => teamOf(map, storeKey, label, store).advertiserId;

export async function loadStoreAdvertisers(db: Db): Promise<StoreAdvertiserMap> {
  const { data: assignments } = await db.from('client_assignments').select('client_id, user_id, job').in('job', ['advertising', 'admin']).limit(10000);
  const clientIds = Array.from(new Set((assignments || []).map((a: any) => a.client_id)));
  const clients: any[] = [];
  for (let i = 0; i < clientIds.length; i += 200) {
    const { data } = await db.from('clients').select('id, name, company_name, store_name').in('id', clientIds.slice(i, i + 200));
    clients.push(...(data || []));
  }

  const { data: manualRows, error: manualErr } = await db.from('perf_store_advertiser').select('store_key, advertiser_id').limit(5000);
  const manual = new Map<string, string>(manualErr ? [] : (manualRows || []).map((r: any) => [r.store_key, r.advertiser_id] as [string, string]));

  // The latest salesman of each client: the Sales column of its newest invoice, else the salesman of its pipeline card.
  const salesOf = new Map<string, string>();
  for (let i = 0; i < clientIds.length; i += 200) {
    const chunk = clientIds.slice(i, i + 200);
    let { data: inv, error } = await db.from('invoices').select('id, client_id, sales_name, issue_date').in('client_id', chunk).eq('is_quotation', false).order('issue_date', { ascending: false });
    if (error) ({ data: inv } = await db.from('invoices').select('id, client_id, issue_date').in('client_id', chunk).eq('is_quotation', false).order('issue_date', { ascending: false }));
    const ids = (inv || []).map((x: any) => x.id);
    const { data: deals } = ids.length ? await db.from('crm_deals').select('invoice_id, salesman_name').in('invoice_id', ids) : { data: [] as any[] };
    const dealName = new Map<string, string>((deals || []).filter((d: any) => d.salesman_name).map((d: any) => [d.invoice_id, String(d.salesman_name)] as [string, string]));
    for (const x of inv || []) {
      if (salesOf.has(x.client_id)) continue;
      const name = String(x.sales_name || dealName.get(x.id) || '').trim();
      if (name) salesOf.set(x.client_id, name);
    }
  }

  // The people.
  const userIds = Array.from(new Set([...(assignments || []).map((a: any) => a.user_id), ...manual.values()]));
  const { data: members } = await db.from('workspace_members').select('user_id').eq('role', 'advertiser');
  for (const m of members || []) if (!userIds.includes(m.user_id)) userIds.push(m.user_id);
  const { data: profiles } = userIds.length ? await db.from('profiles').select('id, full_name, email').in('id', userIds) : { data: [] as any[] };
  const people = new Map<string, string>((profiles || []).map((p: any) => [p.id as string, String(p.full_name || p.email?.split('@')[0] || 'Staff')] as [string, string]));
  const advertiserIds = new Set<string>([...(assignments || []).filter((a: any) => a.job === 'advertising').map((a: any) => a.user_id), ...manual.values(), ...(members || []).map((m: any) => m.user_id)]);
  const advertisers: AdvertiserPerson[] = Array.from(advertiserIds)
    .filter((id) => people.has(id))
    .map((id) => ({ id, name: people.get(id)! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Names -> team. When a name has several candidates the one with the most clients wins.
  const clientById = new Map<string, any>(clients.map((c) => [c.id, c]));
  const votes = new Map<string, { adv: Map<string, number>; adm: Map<string, number>; sales: Map<string, number> }>();
  const bump = (m: Map<string, number>, k: string | undefined) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  for (const a of assignments || []) {
    const c = clientById.get(a.client_id);
    if (!c) continue;
    // The linked store ("ProOne - Toko A", or just "Toko A" for an old entry) by its full text; the client brand and name as a last resort.
    // A "Workspace - Store" is never matched by the bare store name: the same store name can exist in two workspaces.
    const names = [nameKey(c.store_name), nameKey(c.company_name), nameKey(c.name)].filter(Boolean);
    for (const k of new Set(names)) {
      const v = votes.get(k) || { adv: new Map(), adm: new Map(), sales: new Map() };
      if (a.job === 'advertising') bump(v.adv, a.user_id); else bump(v.adm, a.user_id);
      bump(v.sales, salesOf.get(a.client_id));
      votes.set(k, v);
    }
  }
  const top = (m: Map<string, number>) => (m.size ? Array.from(m.entries()).sort((x, y) => y[1] - x[1])[0][0] : '');
  const byName = new Map<string, StoreTeam>();
  for (const [k, v] of votes) byName.set(k, { advertiserId: top(v.adv) || null, adminId: top(v.adm) || null, sales: top(v.sales) });

  return { advertisers, people, byName, manual, manualReady: !manualErr };
}
