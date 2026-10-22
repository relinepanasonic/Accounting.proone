'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, Check, X as XIcon, Loader2 } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';
import { LOG_TIMEZONE } from '@/lib/integrations/upload-log-shared';
import { PROJECT_FILTERS, projectLabel, type MonthStoreRow } from '@/lib/integrations/upload-performance';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none disabled:opacity-60';
const stamp = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-CA', { timeZone: LOG_TIMEZONE });
  return `${day.slice(8, 10)} ${MON[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LOG_TIMEZONE })}`;
};
type SortKey = 'project' | 'client' | 'store' | 'status';

/** Admin > Performance: per store the files uploaded in each week of the month. Click a week to see those files. */
export function AdminPerformance({ rows, errors, year, month, years, todayBlock, daysInMonth }: { rows: MonthStoreRow[]; errors: string[]; year: number; month: number; years: number[]; todayBlock: number; daysInMonth: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [project, setProject] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'project', asc: true });
  const [open, setOpen] = useState<{ row: MonthStoreRow; week: number } | null>(null);

  const go = (key: 'year' | 'month', value: string) => {
    const p = new URLSearchParams(search.toString());
    p.set(key, value);
    setNavigating(true);
    router.push(`${pathname}?${p.toString()}`);
  };

  const list = useMemo(() => {
    const val = (r: MonthStoreRow) => (sort.key === 'project' ? projectLabel(r.project) : sort.key === 'client' ? r.client.toLowerCase() : sort.key === 'store' ? r.store.toLowerCase() : r.status === 'late' ? '0' : r.status === 'on_schedule' ? '1' : '2');
    return rows.filter((r) => project === 'all' || r.project === project).sort((a, b) => String(val(a)).localeCompare(String(val(b))) * (sort.asc ? 1 : -1));
  }, [rows, project, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-3 py-3 align-bottom font-bold">
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>{children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} /></button>
    </th>
  );
  const range = (b: number) => `${b * 7 + 1}-${b === 4 ? daysInMonth : (b + 1) * 7}`;
  const openFiles = open?.row.weekFiles[open.week] || [];

  return (
    <div className="space-y-4">
      {errors.map((e) => (
        <div key={e} className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {e}</div>
      ))}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <select value={project} onChange={(e) => setProject(e.target.value)} className={`${field} w-[220px]`}>
          {PROJECT_FILTERS.map((p) => <option key={p.key} value={p.key}>{p.key === 'all' ? 'Project: All Project' : p.label}</option>)}
        </select>
        <select value={year} onChange={(e) => go('year', e.target.value)} disabled={navigating} className={`${field} w-[130px]`}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => go('month', e.target.value)} disabled={navigating} className={`${field} w-[160px]`}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        {navigating && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
        <span className="ml-auto text-[11px] text-zinc-500">{list.length} store(s)</span>
      </div>

      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
              <tr>
                <Th k="project">Project</Th>
                <Th k="client">Client</Th>
                <Th k="store">Store Name</Th>
                {[0, 1, 2, 3, 4].map((b) => (
                  <th key={b} className={`px-2 py-3 text-center align-bottom font-bold uppercase tracking-wider ${b === todayBlock ? 'text-[#f5d77f]' : ''}`}>
                    <div>Week {b + 1}</div><div className={`text-[9px] font-normal normal-case ${b === todayBlock ? 'text-[#d4af37]' : 'text-zinc-600'}`}>{range(b)}</div>
                  </th>
                ))}
                <Th k="status">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {list.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-zinc-500">{rows.length === 0 ? 'No store in this month. The upload logs could not be read or have no uploads.' : 'No store for this project.'}</td></tr>}
              {list.map((r) => (
                <tr key={`${r.project}|${r.store}`} className="hover:bg-zinc-900/30">
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">{projectLabel(r.project)}</td>
                  <td className="px-3 py-2.5 text-zinc-300">{r.client}</td>
                  <td className="px-3 py-2.5 font-semibold text-zinc-100">{r.store}</td>
                  {r.weekFiles.map((w, b) => (
                    <td key={b} className={`px-2 py-2.5 text-center ${b === todayBlock ? 'bg-[#d4af37]/[0.06]' : ''}`}>
                      {w === null ? <span className="text-zinc-700">-</span> : w.length > 0 ? (
                        <button onClick={() => setOpen({ row: r, week: b })} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-emerald-400 hover:bg-emerald-500/10" title="Show the files">
                          <Check className="h-3.5 w-3.5" />{w.length}
                        </button>
                      ) : <XIcon className="mx-auto h-3.5 w-3.5 text-red-400/70" />}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {r.status === null ? <span className="text-zinc-700">-</span> : (
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${r.status === 'on_schedule' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/40 text-red-400'}`}>{r.status === 'on_schedule' ? 'On Schedule' : 'Late Upload'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-zinc-600">The week comes from the file name (&quot;... week 2.csv&quot;); a file without it counts in the week of its upload day. On Schedule: a file this week or in the last 7 days (a past month: every week has a file).</p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-3xl rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f5d77f]">{open.row.store} · Week {open.week + 1} ({range(open.week)} {MON[month - 1]})</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">{projectLabel(open.row.project)} · {open.row.client} · {openFiles.length} file(s) uploaded</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-zinc-200"><XIcon className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900 text-[10px] uppercase tracking-wider text-zinc-400">
                  <tr><th className="px-3 py-2 font-bold">Type</th><th className="px-3 py-2 font-bold">File</th><th className="px-3 py-2 font-bold">Admin</th><th className="px-3 py-2 font-bold">Uploaded</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {[...openFiles].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)).map((f, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-200">{f.type}</td>
                      <td className="px-3 py-2 text-zinc-400 break-all">{f.name}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{f.admin}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-500">{stamp(f.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
