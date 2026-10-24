import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { AdvertiserPerformanceDashboard, type StoreOption, type AdvertiserSummary } from '@/components/productivity/AdvertiserPerformanceDashboard';
import { fetchPerformance, buildView, storeKeyOf } from '@/lib/integrations/performance';
import { loadStoreAdvertisers, advertiserOf } from '@/lib/integrations/store-advertiser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Advertiser > Dashboard: the store numbers of the two apps together. Profesor Dashboard reports per store, Reline per dealer
 * (no city or brand manager). Filters: year, month (then the charts go per week), Advertiser and Store.
 * Each store belongs to an advertiser: set by hand in the Store Detail table, else the advertiser of the client with that store name.
 */
export default async function AdvertiserDashboardPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; store?: string; advertiser?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const owner = ctx.role === 'superadmin' || ctx.role === 'founder';

  const thisYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const year = Number(sp?.year) > 2000 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const storeKey = String(sp?.store || '');
  const advertiserFilter = String(sp?.advertiser || ''); // '' = all, 'none' = not assigned, else a user id
  const from = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
  const to = month ? `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}` : `${year}-12-31`;

  const [dash, reline, map] = await Promise.all([
    fetchPerformance('dashboard', from, to),
    fetchPerformance('reline', from, to),
    loadStoreAdvertisers(createAdminClient()),
  ]);
  const allRows = [...(dash.ok ? dash.rows : []), ...(reline.ok ? reline.rows : [])];
  const errors = [
    ...(dash.ok ? [] : [`Profesor Dashboard: ${dash.error}`]),
    ...(reline.ok ? [] : [`Reline: ${reline.error}`]),
  ];

  // Whose store is it?
  const owners = new Map<string, string | null>();
  for (const r of allRows) { const k = storeKeyOf(r); if (!owners.has(k)) owners.set(k, advertiserOf(map, k, r.store)); }
  const rows = advertiserFilter
    ? allRows.filter((r) => { const o = owners.get(storeKeyOf(r)) || null; return advertiserFilter === 'none' ? o === null : o === advertiserFilter; })
    : allRows;

  const view = buildView(rows, year, month, storeKey);
  const storeOptions: StoreOption[] = view.stores.map((s) => ({ key: s.key, label: s.workspace ? `${s.store} (${s.workspace})` : s.store, source: s.source }));

  // The job of each advertiser: the stores they handle and the numbers of those stores in this period.
  const everyone = [...map.advertisers.map((a) => ({ id: a.id, name: a.name })), { id: 'none', name: 'Not assigned' }];
  const summaries: AdvertiserSummary[] = everyone.map((a) => {
    const mine = allRows.filter((r) => (a.id === 'none' ? (owners.get(storeKeyOf(r)) || null) === null : owners.get(storeKeyOf(r)) === a.id));
    const v = buildView(mine, year, month, '');
    return { id: a.id, name: a.name, stores: v.stores.length, totals: v.totals, series: v.buckets.map((b) => b.sales) };
  }).filter((s) => s.stores > 0 || s.id !== 'none');

  const assignedTo: Record<string, string> = {};
  for (const [k, v] of owners) if (v) assignedTo[k] = v;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="dashboard" />
      <AdvertiserPerformanceDashboard
        view={view} year={year} month={month} storeKey={storeKey} years={[thisYear, thisYear - 1]} storeOptions={storeOptions} errors={errors}
        advertiserFilter={advertiserFilter} advertisers={map.advertisers} summaries={summaries} assignedTo={assignedTo} canAssign={owner}
        manualByHand={Array.from(map.manual.keys())} manualReady={map.manualReady}
      />
    </div>
  );
}
