import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { AdvertiserClientPerformance, type ClientCard } from '@/components/productivity/AdvertiserClientPerformance';
import { buildView, buildBuckets, rangeBuckets, bucketOf, adsCost, adsSales, storeKeyOf, workspaceLabel, WORKSPACE_LABELS } from '@/lib/integrations/performance';
import { loadStorePerformance } from '@/lib/integrations/store-performance';
import { nameKey } from '@/lib/integrations/store-advertiser';
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
export default async function AdvertiserStorePerformancePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; store?: string; advertiser?: string; company?: string; from?: string; to?: string }> }) {
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
  const view = viewOf(shown);
  // The filters list the stores of the period (not cut by the store that is picked).
  const periodStores = viewOf(byAdvertiser).stores;

  // The Input Log of the clients linked to these stores ("Company - Store" in the Clients table, or an old plain store name).
  const db = createAdminClient();
  const span = range || { from: `${year}-01-01`, to: `${year}-12-31` };
  const { data: linked } = await db.from('clients').select('id, name, store_name').not('store_name', 'is', null).limit(10000);
  const clientsOfName = new Map<string, string[]>();
  for (const c of linked || []) { const k = nameKey(c.store_name); if (k) clientsOfName.set(k, [...(clientsOfName.get(k) || []), c.id]); }
  const clientsOf = (label: string, store: string) => Array.from(new Set([...(clientsOfName.get(nameKey(label)) || []), ...(clientsOfName.get(nameKey(store)) || [])]));
  // Every linked client is read: one whose store is not in the feed (yet) still gets a card for its Input Log.
  const wanted = Array.from(new Set((linked || []).map((c: any) => c.id as string)));
  const reports: InputReport[] = [];
  // Session 1 of the day after the period still belongs to its last day.
  const toPlusOne = addDays(span.to, 1);
  for (let i = 0; i < wanted.length; i += 200) {
    const { data } = await db.from('advertiser_reports').select('client_id, report_date, session, data_inkubasi, data_group, data_mandiri')
      .in('client_id', wanted.slice(i, i + 200)).gte('report_date', span.from).lte('report_date', toPlusOne);
    reports.push(...((data || []) as InputReport[]));
  }
  const days = inputByDay(reports);

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
    const mine = clientsOf(s.label, s.store).map((id) => days.get(id)).filter((m): m is NonNullable<typeof m> => !!m);
    const inp = mine.length ? inputSeries(mine, inputLabels.length, inputBucket) : null;
    const any = inp && [...inp.modal, ...inp.biaya, ...inp.penjualan].some((v) => v > 0);
    return {
      key: s.key,
      name: nameOf(s.key, s.store),
      label: s.label,
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

  // Linked clients with an Input Log but no store in the feed: a card with the Input Log boxes only (GMV and Ads Cost vs ROAS stay empty).
  const covered = new Set(periodStores.flatMap((s) => clientsOf(s.label, s.store)));
  const loose = (linked || []).filter((c: any) => !covered.has(c.id) && days.has(c.id));
  const looseOptions: Array<{ key: string; name: string }> = [];
  if (loose.length) {
    const { data: adv } = await db.from('client_assignments').select('client_id, user_id').eq('job', 'advertising').in('client_id', loose.map((c: any) => c.id));
    const advOf = new Map<string, string>((adv || []).map((a: any) => [a.client_id as string, a.user_id as string]));
    for (const c of loose as any[]) {
      const who = advOf.get(c.id) || null;
      const co = /^\s*(ProOne|Reline|Alpha|Lighting Solution)\b/i.exec(String(c.store_name))?.[1] || '';
      if (companyFilter && co.toLowerCase() !== companyFilter.toLowerCase()) continue;
      if (!owner && (!ctx.userId || who !== ctx.userId)) continue;
      if (advertiserFilter && (advertiserFilter === 'none' ? who !== null : who !== advertiserFilter)) continue;
      const inp = inputSeries([days.get(c.id)!], inputLabels.length, inputBucket);
      if (![...inp.modal, ...inp.biaya, ...inp.penjualan].some((v) => v > 0)) continue;
      const key = `client:${c.id}`;
      const name = c.name || c.store_name;
      looseOptions.push({ key, name });
      if (storeKey && storeKey !== key) continue;
      const zero = view.labels.map(() => 0);
      cards.push({
        key, name, label: String(c.store_name).replace(/\s*-\s*$/, ''),
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
        storeKey={storeKey} storeOptions={storeOptions} clientOptions={clientOptions} errors={errors} companyFilter={companyFilter} companies={companies} range={range}
      />
    </div>
  );
}
