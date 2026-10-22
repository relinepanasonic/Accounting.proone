import React from 'react';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { AdminPerformance } from '@/components/productivity/AdminPerformance';
import { getDashboardUploadLogRange, getRelineUploadLogRange, jakartaDay } from '@/lib/integrations/dashboard-uploads';
import { buildMonthTable, normalizeLogs, storeKey } from '@/lib/integrations/upload-performance';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

/** Admin > Performance: per store the uploads of each week of the month, and which kinds were uploaded. */
export default async function AdminPerformancePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const params = await searchParams;
  const today = jakartaDay(new Date());
  const curYear = Number(today.slice(0, 4));
  const curMonth = Number(today.slice(5, 7));
  const yearNum = Number(params?.year);
  const monthNum = Number(params?.month);
  const year = Number.isInteger(yearNum) && yearNum >= 2024 && yearNum <= curYear + 1 ? yearNum : curYear;
  const month = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : curMonth;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const [prof, reline, clientsRes] = await Promise.all([
    getDashboardUploadLogRange(from, to),
    getRelineUploadLogRange(from, to),
    createAdminClient().from('clients').select('name, company_name, store_name').limit(5000),
  ]);
  const { rows, assigned, errors } = normalizeLogs(prof, reline);

  // The ERP client of a store: by its store name or brand name; a close match counts too.
  const known: Array<{ key: string; name: string }> = [];
  for (const c of (clientsRes.data || []) as any[]) for (const v of [c.store_name, c.company_name, c.name]) if (v && storeKey(String(v)).length >= 4) known.push({ key: storeKey(String(v)), name: c.name });
  const clientOf = (store: string) => {
    const k = storeKey(store);
    if (!k) return '';
    const exact = known.find((x) => x.key === k);
    if (exact) return exact.name;
    return known.find((x) => x.key.length >= 5 && (k.includes(x.key) || x.key.includes(k)))?.name || '';
  };

  const table = buildMonthTable(rows, assigned, year, month, clientOf);
  const todayBlock = year === curYear && month === curMonth ? Math.min(4, Math.floor((Number(today.slice(8, 10)) - 1) / 7)) : -1;
  const years = Array.from({ length: curYear - 2024 + 1 }, (_, i) => curYear - i);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/admin" active="performance" />
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><Shield className="w-8 h-8" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Admin Performance</h1>
          <p className="text-sm text-zinc-400 mt-1">What each store uploaded, week by week</p>
        </div>
      </div>
      <AdminPerformance rows={table} errors={errors} year={year} month={month} years={years} todayBlock={todayBlock} daysInMonth={daysInMonth} />
    </div>
  );
}
