'use client';

import React, { useMemo, useState } from 'react';
import { formatIndoDate } from '@/lib/utils';

export interface ScheduleRow {
  id: string;
  assetId: string;
  asset: string;
  seq: number;
  total: number;
  dueDate: string;
  amount: number;
  posted: boolean;
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const sel = 'rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-bold text-zinc-200 outline-none focus:border-[#d4af37]/60';

/** The monthly payments of every asset, month by month (January first). Filters: year, month, asset, status. */
export function ScheduleTable({ rows, today }: { rows: ScheduleRow[]; today: string }) {
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState<number>(thisYear);
  const [month, setMonth] = useState<number>(0);
  const [asset, setAsset] = useState('');
  const [status, setStatus] = useState<'all' | 'posted' | 'upcoming'>('all');

  const years = useMemo(() => Array.from(new Set([thisYear, ...rows.map((r) => Number(r.dueDate.slice(0, 4)))])).sort((a, b) => a - b), [rows, thisYear]);
  const assets = useMemo(() => Array.from(new Map(rows.map((r) => [r.assetId, r.asset])).entries()), [rows]);

  const shown = useMemo(() => rows.filter((r) => {
    if (Number(r.dueDate.slice(0, 4)) !== year) return false;
    if (month && Number(r.dueDate.slice(5, 7)) !== month) return false;
    if (asset && r.assetId !== asset) return false;
    if (status === 'posted' && !r.posted) return false;
    if (status === 'upcoming' && r.posted) return false;
    return true;
  }), [rows, year, month, asset, status]);

  // Month by month: the payments of a month together, with the month total.
  const byMonth = useMemo(() => {
    const groups = new Map<string, ScheduleRow[]>();
    for (const r of [...shown].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.asset.localeCompare(b.asset))) {
      const k = r.dueDate.slice(0, 7);
      groups.set(k, [...(groups.get(k) || []), r]);
    }
    return Array.from(groups.entries());
  }, [shown]);

  const total = shown.reduce((s, r) => s + r.amount, 0);
  const postedTotal = shown.filter((r) => r.posted).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={sel} aria-label="Year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={sel} aria-label="Month">
          <option value={0}>All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={asset} onChange={(e) => setAsset(e.target.value)} className={`${sel} max-w-[220px]`} aria-label="Asset">
          <option value="">All assets</option>
          {assets.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
          {([['all', 'All'], ['posted', 'Posted'], ['upcoming', 'Upcoming']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatus(k)} className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${status === k ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-300'}`}>{label}</button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-zinc-500">{shown.length} payment{shown.length === 1 ? '' : 's'} · {rp(total)}{postedTotal ? ` · posted ${rp(postedTotal)}` : ''}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d4af37]/20 bg-[#0e0f14]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3">Due date</th>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3 text-center">Payment</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {shown.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No scheduled payment for these filters.</td></tr>}
            {byMonth.map(([key, list]) => (
              <React.Fragment key={key}>
                <tr className="bg-zinc-900/60">
                  <td colSpan={5} className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#f5d77f]">
                    {FULL[Number(key.slice(5, 7)) - 1]} {key.slice(0, 4)}
                    <span className="ml-3 font-mono font-normal normal-case tracking-normal text-zinc-400">{list.length} payment{list.length === 1 ? '' : 's'} · {rp(list.reduce((t, r) => t + r.amount, 0))}</span>
                  </td>
                </tr>
                {list.map((r) => {
              const due = !r.posted && r.dueDate <= today;
              return (
                <tr key={r.id} className="hover:bg-zinc-900/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-300">{formatIndoDate(r.dueDate)}</td>
                  <td className="px-4 py-3 font-semibold text-white">{r.asset}</td>
                  <td className="px-4 py-3 text-center font-mono text-zinc-400">{r.seq} / {r.total}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[#f5d77f]">{rp(r.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.posted
                      ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">Posted</span>
                      : due
                        ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">Due today: posting</span>
                        : <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-[10px] font-bold text-zinc-400">Upcoming</span>}
                  </td>
                </tr>
              );
            })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
