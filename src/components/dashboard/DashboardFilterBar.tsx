'use client';

import React, { useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sel = 'w-full rounded-xl border border-[#d4af37]/30 bg-[#0b0c10] px-4 py-3 text-sm font-bold text-[#f5d77f] outline-none focus:border-[#d4af37] disabled:opacity-60';
const lab = 'mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500';

/** Year | Month | Company filter of the dashboard. Company: all sources, or only one (for example what PT Pintu holds for this company). */
export function DashboardFilterBar({ year, years, companies }: { year: number; years: number[]; companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(search.toString());
    if (value) p.set(key, value); else p.delete(key);
    start(() => router.push(`${pathname}?${p.toString()}`));
  };

  return (
    <div className={`grid gap-4 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4 ${companies.length ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      <div>
        <label className={lab}>Year</label>
        <select value={year} disabled={pending} onChange={(e) => set('year', e.target.value === String(new Date().getFullYear()) ? '' : e.target.value)} className={sel}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label className={lab}>Month</label>
        <select value={search.get('month') ?? ''} disabled={pending} onChange={(e) => set('month', e.target.value)} className={sel}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      </div>
      {companies.length > 0 && (<div>
        <label className={lab}>Company {pending && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</label>
        <select value={search.get('company') ?? ''} disabled={pending} onChange={(e) => set('company', e.target.value)} className={sel}>
          <option value="">All (together)</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>)}
    </div>
  );
}
