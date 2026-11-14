'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, Check, X as XIcon, Loader2, Send } from 'lucide-react';
import { CHECKLIST, buildChecklist, reportMondayOfBlock } from '@/lib/integrations/upload-checklist';
import { reportLabel } from '@/lib/integrations/report-label';
import { sendStoreWeeklyReport } from '@/app/actions/upload-report';
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
export function AdminPerformance({ rows, errors, year, month, years, todayBlock, weeks, reports }: { rows: MonthStoreRow[]; errors: string[]; year: number; month: number; years: number[]; todayBlock: number; weeks: Array<{ monday: string; sunday: string }>; reports: Record<string, { status: string; sentAt: string | null; hasGroup: boolean }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [project, setProject] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'project', asc: true });
  const [open, setOpen] = useState<{ row: MonthStoreRow; week: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [justSent, setJustSent] = useState<Record<string, boolean>>({});
  const monday = (b: number) => reportMondayOfBlock(year, month, b);
  const reportOf = (r: MonthStoreRow, b: number) => { const m = monday(b); return m ? reports[`${reportLabel(r)}|${m}`] : undefined; };
  const isSent = (r: MonthStoreRow, b: number) => reportOf(r, b)?.status === 'sent' || justSent[`${r.project}|${r.store}|${b}`] === true;

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
  const dm = (d: string) => `${Number(d.slice(8, 10))}${d.slice(5, 7) !== String(month).padStart(2, '0') ? ` ${MON[Number(d.slice(5, 7)) - 1]}` : ''}`;
  const range = (b: number) => (weeks[b] ? `${dm(weeks[b].monday)}-${dm(weeks[b].sunday)}` : '');
  const openFiles = open?.row.weekFiles[open.week] || [];
  const openList = buildChecklist(openFiles);
  const doSend = async (resend: boolean) => {
    if (!open) return;
    const m = monday(open.week);
    if (!m) { setSendMsg({ ok: false, text: 'This week has no Monday, so there is no weekly report.' }); return; }
    setSending(true); setSendMsg(null);
    const r = await sendStoreWeeklyReport({ project: open.row.project, store: open.row.store, workspace: open.row.workspace, monday: m, resend });
    setSending(false);
    setSendMsg({ ok: r.ok, text: r.detail });
    if (r.ok) { setJustSent((j) => ({ ...j, [`${open.row.project}|${open.row.store}|${open.week}`]: true })); router.refresh(); }
  };

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
                {weeks.map((_, b) => (
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
                  {r.weekFiles.slice(0, weeks.length).map((w, b) => (
                    <td key={b} className={`px-2 py-2.5 text-center ${b === todayBlock ? 'bg-[#d4af37]/[0.06]' : ''}`}>
                      {w === null ? <span className="text-zinc-700">-</span> : w.length > 0 ? (
                        <button onClick={() => { setSendMsg(null); setOpen({ row: r, week: b }); }} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono hover:bg-emerald-500/10 ${buildChecklist(w).complete ? 'text-emerald-400' : 'text-amber-400'}`} title="Show the checklist">
                          {buildChecklist(w).complete ? <Check className="h-3.5 w-3.5" /> : null}{buildChecklist(w).count}/5{isSent(r, b) && <Send className="h-3 w-3 text-sky-400" />}
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
      <p className="text-[11px] text-zinc-600">Each week needs 5 files: Store Performance, Product Performance, Ads Total, Ads Inkubasi / GMV Max Auto and Ads Group. When all 5 are in, the weekly report is sent to the client&apos;s WhatsApp group (daily check, or press Send in the week). Weeks run Monday to Sunday and belong to the month of their Monday. A file counts in the week it is about: the month and &quot;week N&quot; in its name (&quot;essen ads nov week 1.csv&quot;); a file without a week is the week before its upload. Files of another month (&quot;sep 26&quot;) are not counted here. A week that has not ended is -. On Schedule: every ended week has files (the last one may still be 3 days late).</p>

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
            <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Checklist · {openList.count}/5 files{openList.complete ? ' · complete' : ''}</div>
              <ul className="space-y-1.5 text-xs">
                {CHECKLIST.map((c, i) => {
                  const f = openList.done[c.key];
                  return (
                    <li key={c.key} className="flex items-center gap-2">
                      {f ? <Check className="h-4 w-4 shrink-0 text-emerald-400" /> : <XIcon className="h-4 w-4 shrink-0 text-red-400/80" />}
                      <span className={`w-56 shrink-0 font-semibold ${f ? 'text-zinc-100' : 'text-zinc-400'}`}>{i + 1}. {c.label}</span>
                      <span className="truncate text-zinc-500">{f ? `${f.name} · ${stamp(f.at)}` : 'not uploaded yet'}</span>
                    </li>
                  );
                })}
                <li className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-2">
                  {isSent(open.row, open.week) ? <Check className="h-4 w-4 shrink-0 text-sky-400" /> : <XIcon className="h-4 w-4 shrink-0 text-zinc-600" />}
                  <span className={`w-56 shrink-0 font-semibold ${isSent(open.row, open.week) ? 'text-zinc-100' : 'text-zinc-400'}`}>6. Report sent to the WhatsApp group</span>
                  <span className="text-zinc-500">
                    {isSent(open.row, open.week) ? `sent${reportOf(open.row, open.week)?.sentAt ? ' ' + stamp(reportOf(open.row, open.week)!.sentAt!) : ''}` : openList.complete ? 'will be sent automatically (or press Send)' : 'waits for the 5 files'}
                  </span>
                  <button disabled={sending || !monday(open.week) || (!openList.complete && !isSent(open.row, open.week))} onClick={() => doSend(isSent(open.row, open.week))} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1 text-[11px] font-bold text-[#f5d77f] hover:brightness-125 disabled:opacity-40">
                    {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}{isSent(open.row, open.week) ? 'Send again' : 'Send report'}
                  </button>
                </li>
              </ul>
              {sendMsg && <p className={`mt-2 text-[11px] ${sendMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{sendMsg.text}</p>}
            </div>
            <div className="max-h-[40vh] overflow-auto rounded-xl border border-zinc-800">
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
