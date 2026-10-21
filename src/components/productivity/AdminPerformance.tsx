'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';
import { PROJECT_FILTERS, projectLabel, type StorePerformance } from '@/lib/integrations/upload-performance';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dm = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const dmy = (iso: string) => `${dm(iso)} ${iso.slice(0, 4)}`;

type SortKey = 'project' | 'store' | 'pic' | 'last' | 'status';

/** To-do of the admins: every assigned store against what was uploaded, week by week, with the note On Schedule or Late Upload. */
export function AdminPerformance({ rows, errors }: { rows: StorePerformance[]; errors: string[] }) {
  const [project, setProject] = useState<string>('all');
  const [status, setStatus] = useState<'' | 'on_schedule' | 'late'>('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'status', asc: true });

  const scoped = useMemo(() => rows.filter((r) => project === 'all' || r.project === project), [rows, project]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scoped.filter((r) => (!status || r.status === status) && (!q || `${r.store} ${r.pic}`.toLowerCase().includes(q)));
    const val = (r: StorePerformance): string | number => {
      switch (sort.key) {
        case 'project': return projectLabel(r.project);
        case 'store': return r.store.toLowerCase();
        case 'pic': return r.pic.toLowerCase();
        case 'last': return r.lastUpload || '';
        case 'status': return r.status === 'late' ? 0 : 1;
      }
    };
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (sort.asc ? 1 : -1);
    });
  }, [scoped, status, search, sort]);

  const late = scoped.filter((r) => r.status === 'late').length;
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  const weeks = rows[0]?.weeks || [];
  const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';

  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-3 font-bold ${className}`}>
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>
        {children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} />
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      {errors.map((e) => (
        <div key={e} className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {e}</div>
      ))}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <select value={project} onChange={(e) => setProject(e.target.value)} className={`${field} w-[210px]`}>
          {PROJECT_FILTERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <div className="inline-flex overflow-hidden rounded-lg border border-zinc-800">
          {([['', 'All'], ['late', 'Late Upload'], ['on_schedule', 'On Schedule']] as const).map(([k, label], i) => (
            <button key={k} onClick={() => setStatus(k)} className={`px-4 py-2.5 text-xs font-bold ${i ? 'border-l border-zinc-800' : ''} ${status === k ? 'bg-[#d4af37]/15 text-[#f5d77f]' : 'text-zinc-400 hover:bg-zinc-800/60'}`}>{label}</button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Store or admin" className={`${field} ml-auto w-full min-w-[220px] sm:w-[320px]`} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Stores</div><div className="mt-1 font-serif text-xl font-bold text-white">{scoped.length}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">On Schedule</div><div className="mt-1 font-serif text-xl font-bold text-emerald-400">{scoped.length - late}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Late Upload</div><div className="mt-1 font-serif text-xl font-bold text-red-400">{late}</div></div>
      </div>

      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
              <tr>
                <Th k="project">Project</Th>
                <Th k="store">Store</Th>
                <Th k="pic">Assigned to</Th>
                {weeks.map((w, i) => <th key={w.start} className={`px-2 py-3 text-center font-bold uppercase tracking-wider ${i === weeks.length - 1 ? 'text-[#f5d77f]' : ''}`} title={`Week of ${dmy(w.start)}`}>{i === weeks.length - 1 ? 'This week' : dm(w.start)}</th>)}
                <Th k="last">Last upload</Th>
                <Th k="status">Note</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length === 0 && <tr><td colSpan={5 + weeks.length} className="p-10 text-center text-zinc-500">{rows.length === 0 ? 'No stores yet. The upload logs could not be read.' : 'No store matches these filters.'}</td></tr>}
              {filtered.map((r) => (
                <tr key={`${r.project}|${r.store}`} className="hover:bg-zinc-900/30">
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{projectLabel(r.project)}</td>
                  <td className="px-3 py-3 font-semibold text-zinc-100">{r.store}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{r.pic || '-'}</td>
                  {r.weeks.map((w) => (
                    <td key={w.start} className="px-2 py-3 text-center">
                      {w.count > 0 ? <span className="inline-flex items-center gap-1 font-mono text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{w.count}</span> : <XCircle className="mx-auto h-3.5 w-3.5 text-red-400/70" />}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{r.lastUpload ? `${dmy(r.lastUpload)}${r.daysSince ? ` · ${r.daysSince}d ago` : ' · today'}` : 'never (35 days)'}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${r.status === 'on_schedule' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/40 text-red-400'}`}>{r.status === 'on_schedule' ? 'On Schedule' : 'Late Upload'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-zinc-600">Weeks run Monday to Sunday (Jakarta). On Schedule = the store has an upload this week or in the last 7 days; otherwise Late Upload. Stores come from the admin lists of Profesor Dashboard and Reline plus every store that uploaded.</p>
    </div>
  );
}
