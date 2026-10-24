import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { AdvertiserPerformanceDashboard, type StoreOption, type AdvertiserSummary } from '@/components/productivity/AdvertiserPerformanceDashboard';
import { fetchPerformance, buildView, adsCost, adsSales, storeKeyOf, storeLabel, workspaceLabel, WORKSPACE_LABELS } from '@/lib/integrations/performance';
import { loadStoreAdvertisers, teamOf } from '@/lib/integrations/store-advertiser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Advertiser > Dashboard: the store numbers of the two apps together. Profesor Dashboard reports per store, Reline per dealer
 * (no city or brand manager). Filters: year, month (then the charts go per week), Advertiser and Store.
 * Each store is linked to a client in the Clients table ("Workspace - Store"); the advertiser, admin and salesman of that client are the team of the store. The advertiser can also be set by hand in the Store Detail table.
 */
export default async function AdvertiserDashboardPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; store?: string; advertiser?: string; company?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const owner = ctx.role === 'superadmin' || ctx.role === 'founder';

  const thisYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const year = Number(sp?.year) > 2000 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const storeKey = String(sp?.store || '');
  const companyFilter = String(sp?.company || ''); // '' = all, else ProOne / Reline / Alpha / Lighting Solution
  const advertiserFilter = String(sp?.advertiser || ''); // '' = all, 'none' = not assigned, else a user id
  // The whole year every time (one call, about 2 seconds): the month and its weeks are cut here, and the baseline snapshot of a store is never lost.
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

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
  const teams: Record<string, { admin: string; sales: string }> = {};
  for (const r of allRows) {
    const k = storeKeyOf(r);
    if (owners.has(k)) continue;
    const t = teamOf(map, k, storeLabel(r), r.store);
    owners.set(k, t.advertiserId);
    teams[k] = { admin: t.adminId ? map.people.get(t.adminId) || '' : '', sales: t.sales };
  }
  const companies = WORKSPACE_LABELS.filter((c) => allRows.some((r) => workspaceLabel(r.source, r.workspace) === c)) as string[];
  // Company first, then the stores of that company.
  const rows = allRows.filter((r) => {
    if (companyFilter && workspaceLabel(r.source, r.workspace) !== companyFilter) return false;
    if (!advertiserFilter) return true;
    const o = owners.get(storeKeyOf(r)) || null;
    return advertiserFilter === 'none' ? o === null : o === advertiserFilter;
  });

  const view = buildView(rows, year, month, storeKey);
  const storeOptions: StoreOption[] = view.stores.map((s) => ({ key: s.key, label: s.label, source: s.source }));

  // The job of each advertiser: the stores they handle and the numbers of those stores in this period.
  const everyone = [...map.advertisers.map((a) => ({ id: a.id, name: a.name })), { id: 'none', name: 'Not assigned' }];
  const summaries: AdvertiserSummary[] = everyone.map((a) => {
    const mine = allRows.filter((r) => (a.id === 'none' ? (owners.get(storeKeyOf(r)) || null) === null : owners.get(storeKeyOf(r)) === a.id));
    const v = buildView(mine, year, month, '');
    return { id: a.id, name: a.name, stores: v.stores.length, totals: v.totals, sales: v.buckets.map((b) => b.sales), cost: v.buckets.map(adsCost), adSales: v.buckets.map(adsSales) };
  }).filter((s) => s.stores > 0 || s.id !== 'none');

  const assignedTo: Record<string, string> = {};
  for (const [k, v] of owners) if (v) assignedTo[k] = v;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="dashboard" />
      <AdvertiserPerformanceDashboard
        view={view} year={year} month={month} storeKey={storeKey} years={[thisYear, thisYear - 1]} storeOptions={storeOptions} errors={errors}
        advertiserFilter={advertiserFilter} companyFilter={companyFilter} companies={companies} advertisers={map.advertisers} summaries={summaries} assignedTo={assignedTo} teams={teams} canAssign={owner}
        manualByHand={Array.from(map.manual.keys())} manualReady={map.manualReady}
      />
    </div>
  );
}
