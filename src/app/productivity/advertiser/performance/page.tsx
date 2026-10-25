import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { AdvertiserClientPerformance, type ClientCard } from '@/components/productivity/AdvertiserClientPerformance';
import { buildView, bucketOf, adsCost, adsSales, storeKeyOf } from '@/lib/integrations/performance';
import { loadStorePerformance } from '@/lib/integrations/store-performance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Advertiser > Performance: every client (store) with two boxes, GMV on the left and Ads Cost vs ROAS on the right, sorted by name.
 * Filters: year, month, week (inside the month), advertiser and store; picking a store hides the other clients.
 * Founder and superadmin see every client; an advertiser or admin only the stores they handle.
 */
export default async function AdvertiserStorePerformancePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; week?: string; store?: string; advertiser?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  const thisYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const year = Number(sp?.year) > 2000 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const week = month && Number(sp?.week) >= 1 && Number(sp?.week) <= 5 ? Number(sp.week) : 0;
  const storeKey = String(sp?.store || '');

  const { rows: allRows, errors, map, owners, teams, owner } = await loadStorePerformance(year, { userId: ctx.userId, role: ctx.role });
  const advertiserFilter = owner ? String(sp?.advertiser || '') : ''; // '' = all, 'none' = not assigned, else a user id

  const byAdvertiser = advertiserFilter
    ? allRows.filter((r) => { const o = owners.get(storeKeyOf(r)) || null; return advertiserFilter === 'none' ? o === null : o === advertiserFilter; })
    : allRows;

  const nameOf = (key: string, store: string) => teams[key]?.client || store;
  const sortByName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });

  // The Store filter lists every store of the period (before the store itself is picked).
  const storeOptions = buildView(byAdvertiser, year, month, '').stores
    .map((s) => { const name = nameOf(s.key, s.store); return { key: s.key, name, label: name === s.store ? s.label : `${name} (${s.label})` }; })
    .sort(sortByName)
    .map(({ key, label }) => ({ key, label }));

  const shown = storeKey ? byAdvertiser.filter((r) => storeKeyOf(r) === storeKey) : byAdvertiser;
  const inWeek = week ? shown.filter((r) => bucketOf(r.periodStart, year, month) === week - 1) : shown;
  const view = buildView(inWeek, year, month, '');
  const pick = <T,>(a: T[]) => (week ? [a[week - 1]] : a);

  const cards: ClientCard[] = view.stores.map((s) => ({
    key: s.key,
    name: nameOf(s.key, s.store),
    label: s.label,
    advertiser: teams[s.key]?.advertiserId ? map.people.get(teams[s.key].advertiserId!) || '' : '',
    labels: pick(view.labels),
    gmv: pick(s.gmv),
    cost: pick(s.cost),
    adSales: pick(s.adSales),
    totals: { gmv: s.totals.gmv, cost: adsCost(s.totals), adSales: adsSales(s.totals) },
  })).sort(sortByName);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="performance" />
      <AdvertiserClientPerformance
        cards={cards} year={year} month={month} week={week} years={[thisYear, thisYear - 1]}
        advertiserFilter={advertiserFilter} advertisers={map.advertisers.map((a) => ({ key: a.id, label: a.name }))} showAdvertiser={owner}
        storeKey={storeKey} storeOptions={storeOptions} errors={errors}
      />
    </div>
  );
}
