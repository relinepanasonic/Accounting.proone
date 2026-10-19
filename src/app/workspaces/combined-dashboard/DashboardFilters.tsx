'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sel = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none disabled:opacity-60';
const lab = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500';

/** Year | Month | Client filters of the combined dashboard. Changing one reloads the page with the new numbers. */
export function DashboardFilters({
  workspaces, year, month, client, years, clients,
}: {
  workspaces: string; year: number; month: number | null; client: string; years: number[]; clients: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (next: { year?: number; month?: number | null; client?: string }) => {
    const q = new URLSearchParams();
    q.set('w', workspaces);
    const y = next.year ?? year;
    const m = next.month === undefined ? month : next.month;
    const c = next.client ?? client;
    q.set('year', String(y));
    if (m !== null) q.set('month', String(m));
    if (c) q.set('client', c);
    start(() => router.push(`/workspaces/combined-dashboard?${q.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
      <div>
        <label className={lab}>Year</label>
        <select value={year} disabled={pending} onChange={(e) => go({ year: Number(e.target.value) })} className={sel}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label className={lab}>Month</label>
        <select value={month === null ? '' : month} disabled={pending} onChange={(e) => go({ month: e.target.value === '' ? null : Number(e.target.value) })} className={sel}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="min-w-[220px]">
        <label className={lab}>Client</label>
        <select value={client} disabled={pending} onChange={(e) => go({ client: e.target.value })} className={`${sel} w-full`}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {(month !== null || client || year !== new Date().getFullYear()) && (
        <button type="button" disabled={pending} onClick={() => go({ year: new Date().getFullYear(), month: null, client: '' })} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-500">
          Reset
        </button>
      )}
      {pending && <span className="flex items-center gap-2 pb-2 text-xs text-[#f5d77f]"><Loader2 className="h-4 w-4 animate-spin" /> Updating...</span>}
      {client && <span className="pb-2 text-[11px] text-zinc-500">Costs are not tied to clients, so they are left out while a client is chosen.</span>}
    </div>
  );
}
