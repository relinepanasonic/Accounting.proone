import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { AdvertiserClientPerformance, type ClientCard } from '@/components/productivity/AdvertiserClientPerformance';
import { buildView, buildBuckets, rangeBuckets, bucketOf, adsCost, adsSales, storeKeyOf, workspaceLabel, WORKSPACE_LABELS } from '@/lib/integrations/performance';
import { loadStorePerformance } from '@/lib/integrations/store-performance';
import { nameKey } from '@/lib/integrations/store-advertiser';
import { storeLinks } from '@/lib/sales/client-stores';
import { loadClientRows } from '@/lib/sales/client-table';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { inputByDay, inputSeries, type InputReport } from '@/lib/advertiser/input-series';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * Advertiser > Performance: every client (store) with four boxes, sorted by name:
 * GMV, Ads Cost vs ROAS (from the store feeds: weekly rows, they cannot be split by day),
 * Modal Harian vs Biaya Iklan and Penjualan vs Biaya Iklan (from the Input Log: per day when the period is a month or up to about two months).
 * Filters: period (year, month, or a range of days; a week is a Monday-Sunday range), advertiser, company, client and store;
 * picking a client or store hides the other clients.
 * Founder and superadmin see every client; an advertiser only the stores they handle.
 */
export default async function AdvertiserStorePerformancePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; store?: string; advertiser?: string; company?: string; from?: string; to?: string; open?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  const thisYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const year = Number(sp?.year) > 2000 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const storeKey = String(sp?.store || '');
  const companyFilter = String(sp?.company || '');
  // A range of days (both ends) wins over year and month.
  const isDate = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const range = isDate(sp?.from) && isDate(sp?.to) && String(sp.from) <= String(sp.to) ? { from: String(sp.from), to: String(sp.to) } : null;
  const rangeYear = range ? Number(range.from.slice(0, 4)) : year;

  const { rows: allRows, errors, map, owners, teams, owner } = await loadStorePerformance(range || { from: `${year}-01-01`, to: `${year}-12-31` }, { userId: ctx.userId, role: ctx.role });
  const advertiserFilter = owner ? String(sp?.advertiser || '') : ''; // '' = all, 'none' = not assigned, else a user id

  const companies = WORKSPACE_LABELS.filter((c) => allRows.some((r) => workspaceLabel(r.source, r.workspace) === c)) as string[];
  const byAdvertiser = allRows.filter((r) => {
    if (companyFilter && workspaceLabel(r.source, r.workspace) !== companyFilter) return false;
    if (!advertiserFilter) return true;
    const o = owners.get(storeKeyOf(r)) || null;
    return advertiserFilter === 'none' ? o === null : o === advertiserFilter;
  });
  const rb = range ? rangeBuckets(allRows, range.from, range.to) : null;
  const viewOf = (rs: typeof allRows) => (rb ? buildBuckets(rs, rb.labels, rb.bucket, '', rb.baseDiv) : buildView(rs, year, month, ''));

  const nameOf = (key: string, store: string) => teams[key]?.client || store;
  const sortByName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });

  const shown = storeKey ? byAdvertiser.filter((r) => storeKeyOf(r) === storeKey) : byAdvertiser;
  const viewAll = viewOf(shown);
  // The filters list the stores of the period (not cut by the store that is picked).
  const periodStoresAll = viewOf(byAdvertiser).stores;

  // The Input Log of the clients linked to these stores ("Company - Store" in the Clients table, or an old plain store name).
  const db = createAdminClient();
  const span = range || { from: `${year}-01-01`, to: `${year}-12-31` };
  // One line per store of a client (a client can have several).
  const linked = await storeLinks(db);
  const clientsOfName = new Map<string, string[]>();
  for (const c of linked || []) { const k = nameKey(c.store_name); if (k) clientsOfName.set(k, [...(clientsOfName.get(k) || []), c.id]); }
  const clientsOf = (label: string, store: string) => Array.from(new Set([...(clientsOfName.get(nameKey(label)) || []), ...(clientsOfName.get(nameKey(store)) || [])]));
  // The Input Log is kept per STORE (store_label "Company - Store"). Logs made before that are linked through the store of their client.
  const reports: InputReport[] = [];
  const storeLogs = new Map<string, { label: string; clientId: string }>(); // store key -> its label and the client that logged it
  // Session 1 of the day after the period still belongs to its last day.
  const toPlusOne = addDays(span.to, 1);
  {
    const read = (cols: string) => db.from('advertiser_reports').select(cols).gte('report_date', span.from).lte('report_date', toPlusOne).limit(20000);
    let res: any = await read('client_id, store_label, report_date, session, data_inkubasi, data_group, data_mandiri');
    if (res.error) res = await read('client_id, report_date, session, data_inkubasi, data_group, data_mandiri');
    for (const r of (res.data || []) as any[]) {
      const label = String(r.store_label || '').trim();
      const key = label ? `store:${nameKey(label)}` : String(r.client_id);
      if (label) storeLogs.set(key, { label, clientId: r.client_id });
      reports.push({ ...r, client_id: key });
    }
  }
  const days = inputByDay(reports);

  // Only the clients that are still with us: a client on the Churn page is left out (its stores, numbers and filters).
  const churned = new Set<string>();
  try {
    const gone = await loadClientRows(db, ctx.activeWorkspaceId, { archived: 'only', maskName: (n) => n || '' });
    for (const r of gone) churned.add(r.clientId);
  } catch { /* no churn list: show everything */ }
  const isChurned = (label: string, store: string) => {
    const ids = clientsOf(label, store);
    return ids.length > 0 && ids.every((id) => churned.has(id));
  };
  const periodStores = periodStoresAll.filter((s) => !isChurned(s.label, s.store));
  const view = { ...viewAll, stores: viewAll.stores.filter((s) => !isChurned(s.label, s.store)) };
  /** Every Input Log of a store: by its own label, and the older ones through the client linked to it. */
  const logKeysOf = (label: string, store: string) => Array.from(new Set([...clientsOf(label, store), `store:${nameKey(label)}`]));

  // The Input Log boxes go per day in a month or a range of up to about two months; a year or a longer range goes like the feed boxes.
  const spanDays = Math.round((Date.parse(`${span.to}T00:00:00Z`) - Date.parse(`${span.from}T00:00:00Z`)) / 86400000) + 1;
  const daily = range ? spanDays <= 62 : month > 0;
  let inputLabels = view.labels;
  let inputBucket: (d: string) => number = rb ? rb.dayBucket : (d) => bucketOf(d, rangeYear, month);
  if (daily) {
    const from = range ? range.from : `${year}-${String(month).padStart(2, '0')}-01`;
    const count = range ? spanDays : new Date(Date.UTC(year, month, 0)).getUTCDate();
    const keys = Array.from({ length: count }, (_, i) => addDays(from, i));
    inputLabels = keys.map((k) => `${k.slice(8, 10)} ${MON[Number(k.slice(5, 7)) - 1]}`);
    inputBucket = (d) => keys.indexOf(d);
  }

  const cards: ClientCard[] = view.stores.map((s) => {
    const mine = logKeysOf(s.label, s.store).map((id) => days.get(id)).filter((m): m is NonNullable<typeof m> => !!m);
    const inp = mine.length ? inputSeries(mine, inputLabels.length, inputBucket) : null;
    const any = inp && [...inp.modal, ...inp.biaya, ...inp.penjualan].some((v) => v > 0);
    return {
      key: s.key,
      name: nameOf(s.key, s.store),
      label: s.label,
      logLabel: s.label,
      logClientIds: clientsOf(s.label, s.store),
      advertiser: teams[s.key]?.advertiserId ? map.people.get(teams[s.key].advertiserId!) || '' : '',
      labels: view.labels,
      inputLabels,
      gmv: s.gmv,
      cost: s.cost,
      adSales: s.adSales,
      totals: { gmv: s.totals.gmv, cost: adsCost(s.totals), adSales: adsSales(s.totals) },
      input: inp && any ? { modal: inp.modal, biaya: inp.biaya, biayaBudgeted: inp.biayaBudgeted, penjualan: inp.penjualan, target: inp.target } : null,
    };
  }).sort(sortByName);

  // A store with an Input Log but not in the feeds (yet): a card with the Input Log boxes only (GMV and Ads Cost vs ROAS stay empty).
  const covered = new Set(periodStores.flatMap((s) => logKeysOf(s.label, s.store)));
  const loose = Array.from(storeLogs.entries()).filter(([key]) => !covered.has(key) && days.has(key));
  const looseOptions: Array<{ key: string; name: string }> = [];
  if (loose.length) {
    const clientIds = Array.from(new Set(loose.map(([, v]) => v.clientId)));
    const { data: adv } = await db.from('client_assignments').select('client_id, user_id').eq('job', 'advertising').in('client_id', clientIds);
    const advOf = new Map<string, string>((adv || []).map((a: any) => [a.client_id as string, a.user_id as string]));
    const { data: names } = await db.from('clients').select('id, name').in('id', clientIds);
    const nameOfClient = new Map<string, string>((names || []).map((n: any) => [n.id as string, n.name as string]));
    for (const [key, v] of loose) {
      const who = advOf.get(v.clientId) || null;
      const co = /^s*(ProOne|Reline|Alpha|Lighting Solution)/i.exec(v.label)?.[1] || '';
      if (churned.has(v.clientId)) continue;
      if (companyFilter && co.toLowerCase() !== companyFilter.toLowerCase()) continue;
      if (!owner && (!ctx.userId || who !== ctx.userId)) continue;
      if (advertiserFilter && (advertiserFilter === 'none' ? who !== null : who !== advertiserFilter)) continue;
      const inp = inputSeries([days.get(key)!], inputLabels.length, inputBucket);
      if (![...inp.modal, ...inp.biaya, ...inp.penjualan].some((x) => x > 0)) continue;
      const name = nameOfClient.get(v.clientId) || v.label;
      looseOptions.push({ key, name });
      if (storeKey && storeKey !== key) continue;
      const zero = view.labels.map(() => 0);
      cards.push({
        key, name, label: v.label.replace(/s*-s*$/, ''), logLabel: v.label, logClientIds: [v.clientId],
        advertiser: who ? map.people.get(who) || '' : '', labels: view.labels, inputLabels, gmv: zero, cost: zero, adSales: zero,
        totals: { gmv: 0, cost: 0, adSales: 0 },
        input: { modal: inp.modal, biaya: inp.biaya, biayaBudgeted: inp.biayaBudgeted, penjualan: inp.penjualan, target: inp.target },
      });
    }
    cards.sort(sortByName);
  }

  // Client filter: the client names; Store filter: just the store names. Both A to Z.
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'id', { sensitivity: 'base' });
  const clientOptions = [
    ...periodStores.filter((s) => teams[s.key]?.client).map((s) => ({ key: s.key, label: teams[s.key].client })),
    ...looseOptions.map((o) => ({ key: o.key, label: o.name })),
  ].sort(byLabel);
  const storeOptions = periodStores.map((s) => ({ key: s.key, label: s.store })).sort(byLabel);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="performance" />
      <AdvertiserClientPerformance
        cards={cards} year={year} month={month} years={[thisYear, thisYear - 1]}
        advertiserFilter={advertiserFilter} advertisers={map.advertisers.map((a) => ({ key: a.id, label: a.name }))} showAdvertiser={owner}
        storeKey={storeKey} storeOptions={storeOptions} clientOptions={clientOptions} errors={errors} companyFilter={companyFilter} companies={companies} range={range} initialOpen={String(sp?.open || '')}
      />
    </div>
  );
}
