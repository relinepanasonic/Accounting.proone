'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, Check, X as XIcon, Loader2 } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';
import { PROJECT_FILTERS, UPLOAD_KINDS, projectLabel, type MonthStoreRow } from '@/lib/integrations/upload-performance';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none disabled:opacity-60';
type SortKey = 'project' | 'client' | 'store';

/** Admin > Performance: per store, the uploads of each week of the month and which kinds were uploaded. */
export function AdminPerformance({ rows, errors, year, month, years, todayBlock, daysInMonth }: { rows: MonthStoreRow[]; errors: string[]; year: number; month: number; years: number[]; todayBlock: number; daysInMonth: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [project, setProject] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'project', asc: true });

  const go = (key: 'year' | 'month', value: string) => {
    const p = new URLSearchParams(search.toString());
    p.set(key, value);
    setNavigating(true);
    router.push(`${pathname}?${p.toString()}`);
  };

  const list = useMemo(() => {
    const val = (r: MonthStoreRow) => (sort.key === 'project' ? projectLabel(r.project) : sort.key === 'client' ? r.client.toLowerCase() : r.store.toLowerCase());
    return rows.filter((r) => project === 'all' || r.project === project).sort((a, b) => String(val(a)).localeCompare(String(val(b))) * (sort.asc ? 1 : -1));
  }, [rows, project, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th rowSpan={2} className="px-3 py-2 align-bottom font-bold">
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>{children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} /></button>
    </th>
  );
  const range = (b: number) => `${b * 7 + 1}-${b === 4 ? daysInMonth : (b + 1) * 7}`;

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
                  <th key={b} rowSpan={2} className={`px-2 py-2 text-center align-bottom font-bold uppercase tracking-wider ${b === todayBlock ? 'text-[#f5d77f]' : ''}`}>
                    <div>Week {b + 1}</div><div className={`text-[9px] font-normal normal-case ${b === todayBlock ? 'text-[#d4af37]' : 'text-zinc-600'}`}>{range(b)}</div>
                  </th>
                ))}
                <th colSpan={UPLOAD_KINDS.length} className="border-l border-zinc-800 px-2 py-2 text-center font-bold uppercase tracking-wider">Upload</th>
              </tr>
              <tr>
                {UPLOAD_KINDS.map((u, i) => <th key={u.key} className={`px-1.5 py-2 text-center text-[9px] font-bold uppercase leading-tight tracking-wide ${i === 0 ? 'border-l border-zinc-800' : ''}`}>{u.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {list.length === 0 && <tr><td colSpan={3 + 5 + UPLOAD_KINDS.length} className="p-10 text-center text-zinc-500">{rows.length === 0 ? 'No store in this month. The upload logs could not be read or have no uploads.' : 'No store for this project.'}</td></tr>}
              {list.map((r) => (
                <tr key={`${r.project}|${r.store}`} className="hover:bg-zinc-900/30">
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">{projectLabel(r.project)}</td>
                  <td className="px-3 py-2.5 text-zinc-300">{r.client}</td>
                  <td className="px-3 py-2.5 font-semibold text-zinc-100">{r.store}</td>
                  {r.weeks.map((w, b) => (
                    <td key={b} className={`px-2 py-2.5 text-center ${b === todayBlock ? 'bg-[#d4af37]/[0.06]' : ''}`}>
                      {w === null ? <span className="text-zinc-700">-</span> : w > 0 ? <span className="inline-flex items-center gap-1 font-mono text-emerald-400"><Check className="h-3.5 w-3.5" />{w}</span> : <XIcon className="mx-auto h-3.5 w-3.5 text-red-400/70" />}
                    </td>
                  ))}
                  {UPLOAD_KINDS.map((u, i) => {
                    const v = r.kinds[u.key];
                    return (
                      <td key={u.key} className={`px-1.5 py-2.5 text-center ${i === 0 ? 'border-l border-zinc-800' : ''}`}>
                        {v === null ? <span className="text-zinc-800" title="Not carried by this project">n/a</span> : v ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" /> : <span className="inline-block h-2 w-2 rounded-full bg-zinc-700" title="Not uploaded yet" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
