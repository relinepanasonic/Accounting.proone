// The store numbers of both feeds with the team of each store, cut to what the viewer may see. Server-side only.
// Founder and superadmin see every store; an advertiser only the stores they handle. (The admin division has no access to these pages: see proxy.ts.)
import { createAdminClient } from '@/lib/api/supabase-admin';
import { fetchPerformance, storeKeyOf, storeLabel, type PerfRow } from '@/lib/integrations/performance';
import { loadStoreAdvertisers, teamOf, type StoreAdvertiserMap } from '@/lib/integrations/store-advertiser';

export interface StoreTeamNames { advertiserId: string | null; admin: string; sales: string; client: string }

export interface StorePerformance {
  rows: PerfRow[];
  errors: string[];
  map: StoreAdvertiserMap;
  /** Store key -> advertiser id (null = not assigned). */
  owners: Map<string, string | null>;
  teams: Record<string, StoreTeamNames>;
  /** Founder or superadmin: sees all stores and can assign. */
  owner: boolean;
}

export async function loadStorePerformance(year: number, viewer: { userId: string | null; role: string }): Promise<StorePerformance> {
  // The whole year every time (one call, about 2 seconds): the month and its weeks are cut in memory, and the baseline snapshot of a store is never lost.
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
  const teams: Record<string, StoreTeamNames> = {};
  for (const r of allRows) {
    const k = storeKeyOf(r);
    if (owners.has(k)) continue;
    const t = teamOf(map, k, storeLabel(r), r.store);
    owners.set(k, t.advertiserId);
    teams[k] = { advertiserId: t.advertiserId, admin: t.adminId ? map.people.get(t.adminId) || '' : '', sales: t.sales, client: t.client };
  }

  const owner = viewer.role === 'superadmin' || viewer.role === 'founder';
  const rows = owner
    ? allRows
    : allRows.filter((r) => !!viewer.userId && owners.get(storeKeyOf(r)) === viewer.userId);
  return { rows, errors, map, owners, teams, owner };
}
