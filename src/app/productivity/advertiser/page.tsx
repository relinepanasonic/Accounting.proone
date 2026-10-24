import React from 'react';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { AdvertiserPerformanceDashboard, type StoreOption } from '@/components/productivity/AdvertiserPerformanceDashboard';
import { fetchPerformance, buildView } from '@/lib/integrations/performance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Advertiser > Dashboard: the store numbers of the two apps together. Profesor Dashboard reports per store, Reline per dealer
 * (no city or brand manager). Filters: year, month (then the charts go per week) and Store.
 */
export default async function AdvertiserDashboardPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; store?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const year = Number(sp?.year) > 2000 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const storeKey = String(sp?.store || '');
  const from = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
  const to = month ? `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}` : `${year}-12-31`;

  const [dash, reline] = await Promise.all([fetchPerformance('dashboard', from, to), fetchPerformance('reline', from, to)]);
  const rows = [...(dash.ok ? dash.rows : []), ...(reline.ok ? reline.rows : [])];
  const errors = [
    ...(dash.ok ? [] : [`Profesor Dashboard: ${dash.error}`]),
    ...(reline.ok ? [] : [`Reline: ${reline.error}`]),
  ];
  const view = buildView(rows, year, month, storeKey);
  const storeOptions: StoreOption[] = view.stores.map((s) => ({ key: s.key, label: s.workspace ? `${s.store} (${s.workspace})` : s.store, source: s.source }));
  const years = [thisYear, thisYear - 1];

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="dashboard" />
      <AdvertiserPerformanceDashboard view={view} year={year} month={month} storeKey={storeKey} years={years} storeOptions={storeOptions} errors={errors} />
    </div>
  );
}
