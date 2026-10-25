import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { AdvertiserPerformanceDashboard, type StoreOption, type AdvertiserSummary } from '@/components/productivity/AdvertiserPerformanceDashboard';
import { buildView, adsCost, adsSales, storeKeyOf, workspaceLabel, WORKSPACE_LABELS } from '@/lib/integrations/performance';
import { loadStorePerformance } from '@/lib/integrations/store-performance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Advertiser > Dashboard: the store numbers of the two apps together. Profesor Dashboard reports per store, Reline per dealer
 * (no city or brand manager). Filters: year, month (then the charts go per week), Company and Store.
 * Founder and superadmin see every store; an advertiser or admin only the stores they handle.
 * Each store is linked to a client in the Clients table ("Workspace - Store"); the advertiser, admin and salesman of that client are the team of the store. The advertiser can also be set by hand in the Store Detail table.
 */
export default async function AdvertiserDashboardPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; store?: string; advertiser?: string; company?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  const thisYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const year = Number(sp?.year) > 2000 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const storeKey = String(sp?.store || '');
  const companyFilter = String(sp?.company || ''); // '' = all, else ProOne / Reline / Alpha / Lighting Solution
  const advertiserFilter = String(sp?.advertiser || ''); // '' = all, 'none' = not assigned, else a user id
  // Founder and superadmin see every store; an advertiser or admin only their own.
  const { rows: allRows, errors, map, owners, teams, owner } = await loadStorePerformance(year, { userId: ctx.userId, role: ctx.role });

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
    return { id: a.id, name: a.name, stores: v.stores.length, totals: v.totals, gmv: v.buckets.map((b) => b.gmv), cost: v.buckets.map(adsCost), adSales: v.buckets.map(adsSales) };
  }).filter((s) => s.stores > 0 || (owner && s.id !== 'none'));
  const advertisers = owner ? map.advertisers : map.advertisers.filter((a) => summaries.some((s) => s.id === a.id));

  const assignedTo: Record<string, string> = {};
  for (const [k, v] of owners) if (v) assignedTo[k] = v;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="dashboard" />
      <AdvertiserPerformanceDashboard
        view={view} year={year} month={month} storeKey={storeKey} years={[thisYear, thisYear - 1]} storeOptions={storeOptions} errors={errors}
        advertiserFilter={advertiserFilter} companyFilter={companyFilter} companies={companies} advertisers={advertisers} summaries={summaries} assignedTo={assignedTo} teams={teams} canAssign={owner}
        manualByHand={Array.from(map.manual.keys())} manualReady={map.manualReady}
      />
    </div>
  );
}
