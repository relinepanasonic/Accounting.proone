'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';
import { PROJECT_FILTERS, projectLabel, type LogRow } from '@/lib/integrations/upload-performance';
import { LOG_TIMEZONE } from '@/lib/integrations/upload-log-shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dmy = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LOG_TIMEZONE });
const PAGE = 100;

type SortKey = 'at' | 'project' | 'admin' | 'store' | 'type' | 'month';

/** Log Detail: every upload of Profesor Dashboard and Reline, filtered by project. */
export function AdminLogDetail({ rows, errors, days }: { rows: LogRow[]; errors: string[]; days: number }) {
  const [project, setProject] = useState<string>('all');
  const [admin, setAdmin] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'at', asc: false });

  const scoped = useMemo(() => rows.filter((r) => project === 'all' || r.project === project), [rows, project]);
  const admins = useMemo(() => Array.from(new Set(scoped.map((r) => r.admin))).sort(), [scoped]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scoped.filter((r) => (!admin || r.admin === admin) && (!q || `${r.store} ${r.type} ${r.admin} ${r.files.join(' ')}`.toLowerCase().includes(q)));
    const val = (r: LogRow) => (sort.key === 'at' ? r.at : sort.key === 'project' ? projectLabel(r.project) : (r[sort.key] as string).toLowerCase());
    return [...list].sort((a, b) => String(val(a)).localeCompare(String(val(b))) * (sort.asc ? 1 : -1));
  }, [scoped, admin, search, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key !== 'at' }));
  const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-3 py-3 font-bold">
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

      <div className="flex flex-wrap gap-2">
        {PROJECT_FILTERS.map((p) => (
          <button key={p.key} onClick={() => { setProject(p.key); setAdmin(''); setShown(PAGE); }} className={`rounded-full border px-4 py-1.5 text-xs font-bold ${project === p.key ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f5d77f]' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
            {p.label} <span className="ml-1 font-mono text-[10px] opacity-70">{p.key === 'all' ? rows.length : rows.filter((r) => r.project === p.key).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <select value={admin} onChange={(e) => { setAdmin(e.target.value); setShown(PAGE); }} className={`${field} w-[200px]`}>
          <option value="">All admins</option>
          {admins.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} placeholder="Store, type or file name" className={`${field} ml-auto w-full min-w-[220px] sm:w-[340px]`} />
        <span className="text-[11px] text-zinc-500">Last {days} days · {filtered.length} uploads</span>
      </div>

      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
              <tr><Th k="at">Date / time</Th><Th k="project">Project</Th><Th k="admin">Admin</Th><Th k="store">Store</Th><Th k="type">Type</Th><Th k="month">Month</Th><th className="px-3 py-3 font-bold uppercase tracking-wider">Files</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-zinc-500">No upload matches these filters.</td></tr>}
              {filtered.slice(0, shown).map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-zinc-900/30">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-zinc-300">{dmy(r.day)} <span className="text-zinc-500">{time(r.at)}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{projectLabel(r.project)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-zinc-200">{r.admin}</td>
                    <td className="px-3 py-3 text-[#f5d77f]">{r.store}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{r.type}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-500">{r.month || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {r.files.length > 0 ? <button onClick={() => setOpen(open === r.id ? null : r.id)} className="text-zinc-400 underline decoration-dotted hover:text-zinc-200">{r.files.length} file(s)</button> : <span className="text-zinc-700">-</span>}
                    </td>
                  </tr>
                  {open === r.id && <tr><td colSpan={7} className="bg-zinc-950/60 px-4 py-2 text-[11px] text-zinc-500 break-all">{r.files.join(' · ')}</td></tr>}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > shown && (
          <div className="flex justify-center border-t border-zinc-800/60 p-4">
            <button onClick={() => setShown((n) => n + PAGE)} className="rounded-lg border border-[#d4af37]/40 px-6 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/10">Show more ({filtered.length - shown} left)</button>
          </div>
        )}
      </div>
    </div>
  );
}
