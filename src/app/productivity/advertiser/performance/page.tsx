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

/**
 * Advertiser > Performance: every client (store) with two boxes, GMV on the left and Ads Cost vs ROAS on the right, sorted by name.
 * Filters: year, month, week (inside the month) or a date range, advertiser, company and store; picking a store hides the other clients.
 * Two more boxes come from the Input Log of the client linked to the store: Modal Harian vs Biaya Iklan (with Target vs actual ROAS)
 * and Penjualan vs Biaya Iklan vs ROAS.
 * Founder and superadmin see every client; an advertiser only the stores they handle.
 */
export default async function AdvertiserStorePerformancePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; week?: string; store?: string; advertiser?: string; company?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  const thisYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const year = Number(sp?.year) > 2000 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const week = month && Number(sp?.week) >= 1 && Number(sp?.week) <= 5 ? Number(sp.week) : 0;
  const storeKey = String(sp?.store || '');
  const companyFilter = String(sp?.company || '');
  // A date range (both ends) wins over year, month and week.
  const isDate = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const range = isDate(sp?.from) && isDate(sp?.to) && String(sp.from) <= String(sp.to) ? { from: String(sp.from), to: String(sp.to) } : null;

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

  // The Store filter lists every store of the period (before the store itself is picked).
  const storeOptions = viewOf(byAdvertiser).stores
    .map((s) => { const name = nameOf(s.key, s.store); return { key: s.key, name, label: name === s.store ? s.label : `${name} (${s.label})` }; })
    .sort(sortByName)
    .map(({ key, label }) => ({ key, label }));

  const shown = storeKey ? byAdvertiser.filter((r) => storeKeyOf(r) === storeKey) : byAdvertiser;
  const inWeek = week && !rb ? shown.filter((r) => bucketOf(r.periodStart, year, month) === week - 1) : shown;
  const view = viewOf(inWeek);
  const pick = <T,>(a: T[]) => (week && !rb ? [a[week - 1]] : a);

  // The Input Log of the clients linked to these stores ("Company - Store" in the Clients table, or an old plain store name).
  const db = createAdminClient();
  const span = range || { from: `${year}-01-01`, to: `${year}-12-31` };
  const { data: linked } = await db.from('clients').select('id, store_name').not('store_name', 'is', null).limit(10000);
  const clientsOfName = new Map<string, string[]>();
  for (const c of linked || []) { const k = nameKey(c.store_name); if (k) clientsOfName.set(k, [...(clientsOfName.get(k) || []), c.id]); }
  const clientsOf = (label: string, store: string) => Array.from(new Set([...(clientsOfName.get(nameKey(label)) || []), ...(clientsOfName.get(nameKey(store)) || [])]));
  const wanted = Array.from(new Set(view.stores.flatMap((s) => clientsOf(s.label, s.store))));
  const reports: InputReport[] = [];
  // Session 1 of the day after the period still belongs to its last day.
  const toPlusOne = new Date(Date.parse(`${span.to}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < wanted.length; i += 200) {
    const { data } = await db.from('advertiser_reports').select('client_id, report_date, session, data_inkubasi, data_group, data_mandiri')
      .in('client_id', wanted.slice(i, i + 200)).gte('report_date', span.from).lte('report_date', toPlusOne);
    reports.push(...((data || []) as InputReport[]));
  }
  const days = inputByDay(reports);
  const dayBucket = rb ? rb.dayBucket : (d: string) => bucketOf(d, year, month);

  const cards: ClientCard[] = view.stores.map((s) => {
    const mine = clientsOf(s.label, s.store).map((id) => days.get(id)).filter((m): m is NonNullable<typeof m> => !!m);
    const inp = mine.length ? inputSeries(mine, view.labels.length, dayBucket) : null;
    const any = inp && [...inp.modal, ...inp.biaya, ...inp.penjualan].some((v) => v > 0);
    return ({
    key: s.key,
    name: nameOf(s.key, s.store),
    label: s.label,
    advertiser: teams[s.key]?.advertiserId ? map.people.get(teams[s.key].advertiserId!) || '' : '',
    labels: pick(view.labels),
    gmv: pick(s.gmv),
    cost: pick(s.cost),
    adSales: pick(s.adSales),
    totals: { gmv: s.totals.gmv, cost: adsCost(s.totals), adSales: adsSales(s.totals) },
    input: inp && any ? { modal: pick(inp.modal), biaya: pick(inp.biaya), biayaBudgeted: pick(inp.biayaBudgeted), penjualan: pick(inp.penjualan), target: pick(inp.target) } : null,
  });
  }).sort(sortByName);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="performance" />
      <AdvertiserClientPerformance
        cards={cards} year={year} month={month} week={week} years={[thisYear, thisYear - 1]}
        advertiserFilter={advertiserFilter} advertisers={map.advertisers.map((a) => ({ key: a.id, label: a.name }))} showAdvertiser={owner}
        storeKey={storeKey} storeOptions={storeOptions} errors={errors} companyFilter={companyFilter} companies={companies} range={range}
      />
    </div>
  );
}
