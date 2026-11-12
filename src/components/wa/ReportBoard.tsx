'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { getWeekDetail } from '@/app/actions/wa';
import { DAY_LABELS, dayState, type BoardCell, type DayCell, type MonthWeek } from '@/lib/wa/board';

export interface BoardRowView { store: string; client: string; weeks: BoardCell[]; monthly: BoardCell }
interface Detail { client: string | null; clientId: string | null; days: DayCell[]; week: BoardCell }

const th = 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500';
const shortDay = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const range = (w: MonthWeek) => `${Number(w.from.slice(8, 10))}-${Number(w.to.slice(8, 10))}${w.from.slice(5, 7) !== w.to.slice(5, 7) ? '/' + Number(w.to.slice(5, 7)) : ''}`;

/** One cell of a weekly report: a check when it was sent (click it to see the image), a dot while it is only a draft, a cross when it failed. */
function Cell({ cell, onOpen, title }: { cell: BoardCell; onOpen?: (src: string) => void; title: string }) {
  if (cell.state === 'sent') {
    return onOpen && cell.id
      ? <button onClick={(e) => { e.stopPropagation(); onOpen(`/api/wa/report-image/${cell.id}`); }} title={`Sent. Click to see the ${title}`} className="rounded px-2 py-0.5 text-base font-bold text-emerald-400 hover:bg-emerald-500/15">✓</button>
      : <span className="px-2 text-base font-bold text-emerald-400" title="Sent">✓</span>;
  }
  if (cell.state === 'draft') return <span className="px-2 text-[11px] font-bold text-amber-400" title="A draft: waiting for an admin to approve it">draft</span>;
  if (cell.state === 'failed') return <span className="px-2 text-base font-bold text-red-400" title="Sending failed">✗</span>;
  if (cell.state === 'skipped') return <span className="px-2 text-[11px] text-zinc-500" title="Skipped this week">skip</span>;
  return <span className="px-2 text-zinc-700">–</span>;
}

/** One day of the detail: how many session reports were sent that day (click to see the last one), or logged and not sent yet. */
function DayView({ d, onOpen }: { d: DayCell; onOpen: (src: string) => void }) {
  const s = dayState(d);
  if (s === 'none') return <span className="px-2 text-zinc-700">–</span>;
  if (s === 'logged') return <span className="px-2 text-sm font-bold text-amber-400" title={`${d.logged} session report(s) logged, none sent to the client`}>○ {d.logged}</span>;
  const label = s === 'sent' ? `✓ ${d.sent}` : `✓ ${d.sent}/${d.logged}`;
  const color = s === 'sent' ? 'text-emerald-400 hover:bg-emerald-500/15' : 'text-lime-300 hover:bg-lime-500/15';
  return d.hasCopy && d.sendId
    ? <button onClick={() => onOpen(`/api/wa/sent-image/${d.sendId}`)} title={`${d.sent} sent of ${d.logged} logged. Click to see the last one`} className={`rounded px-2 py-0.5 text-sm font-bold ${color}`}>{label}</button>
    : <span className={`px-2 text-sm font-bold ${color.split(' ')[0]}`} title={`${d.sent} sent of ${d.logged} logged (no saved copy of these)`}>{label}</span>;
}

function Modal({ src, onClose }: { src: string; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-[#d4af37]/30 bg-[#0e0f14] p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#f5d77f]">The report that was sent</span>
          <button onClick={onClose} className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:text-white">Close</button>
        </div>
        {failed ? <p className="p-8 text-center text-sm text-zinc-400">There is no saved copy of this one (it was sent before copies were kept).</p>
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={src} alt="The report that was sent" className="w-full rounded bg-white" onError={() => setFailed(true)} />}
      </div>
    </div>
  );
}

export function ReportBoard({ month, monthLabel, prevMonth, nextMonth, weeks, rows }: { month: string; monthLabel: string; prevMonth: string; nextMonth: string; weeks: MonthWeek[]; rows: BoardRowView[] }) {
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [weekFrom, setWeekFrom] = useState<string>('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = (store: string, from: string) => start(async () => {
    setErr(''); setDetail(null);
    const r: any = await getWeekDetail(store, from);
    if (r?.error) setErr(r.error); else setDetail(r.detail);
  });
  const toggle = (r: BoardRowView) => {
    if (openStore === r.store) { setOpenStore(null); return; }
    // the latest week that has a report, else the last week of the month
    const idx = [...r.weeks].map((c, i) => (c.state !== 'none' ? i : -1)).filter((i) => i >= 0).pop();
    const from = weeks[idx ?? weeks.length - 1]?.from || '';
    setOpenStore(r.store); setWeekFrom(from);
    if (from) load(r.store, from);
  };
  const pickWeek = (store: string, from: string) => { setWeekFrom(from); load(store, from); };
  const cols = 3 + weeks.length;

  return (
    <section className="rounded-xl border border-[#d4af37]/15 bg-[#0e0f14]/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Client reports sent by Oli</h2>
          <p className="mt-1 text-[11px] text-zinc-500">A check means the report was sent to the client. Click a check to see the image that was sent. Click a row to see the days of a week.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link href={`?month=${prevMonth}`} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-[#d4af37]/50">‹</Link>
          <span className="min-w-[8rem] text-center font-bold text-zinc-100">{monthLabel}</span>
          <Link href={`?month=${nextMonth}`} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-[#d4af37]/50">›</Link>
        </div>
      </div>

      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0e0f14]">
            <tr>
              <th className={th}>Client</th><th className={th}>Store</th>
              {weeks.map((w) => <th key={w.from} className={`${th} text-center`}>{w.label}<div className="font-normal normal-case text-zinc-600">{range(w)}</div></th>)}
              <th className={`${th} text-center`}>Monthly Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.length === 0 && <tr><td colSpan={cols} className="py-8 text-center text-zinc-500">No weekly report for {monthLabel} yet. Press Prepare now in the drafts below.</td></tr>}
            {rows.map((r) => (
              <React.Fragment key={r.store}>
                <tr className={`cursor-pointer hover:bg-zinc-900/40 ${openStore === r.store ? 'bg-zinc-900/50' : ''}`} onClick={() => toggle(r)}>
                  <td className="px-3 py-2 font-semibold text-zinc-100">{r.client || '-'}</td>
                  <td className="px-3 py-2 text-zinc-300">{r.store}</td>
                  {r.weeks.map((c, i) => <td key={i} className="px-3 py-2 text-center"><Cell cell={c} onOpen={setModal} title="weekly report" /></td>)}
                  <td className="px-3 py-2 text-center"><Cell cell={r.monthly} title="monthly report" /></td>
                </tr>
                {openStore === r.store && (
                  <tr><td colSpan={cols} className="bg-black/30 px-3 py-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Week</span>
                      {weeks.map((w) => (
                        <button key={w.from} onClick={() => pickWeek(r.store, w.from)} className={`rounded-full border px-3 py-0.5 text-[11px] font-bold ${weekFrom === w.from ? 'border-[#d4af37]/50 bg-[#d4af37]/20 text-[#f5d77f]' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`}>{w.label} · {range(w)}</button>
                      ))}
                    </div>
                    {err && <p className="text-xs text-red-400">{err}</p>}
                    {pending && !detail && <p className="text-xs text-zinc-500">Loading...</p>}
                    {detail && (
                      <table className="w-full text-xs">
                        <thead><tr>
                          <th className={th}>Client</th><th className={th}>Store</th>
                          {DAY_LABELS.map((d, i) => <th key={d} className={`${th} text-center`}>{d}<div className="font-normal normal-case text-zinc-600">{shortDay(detail.days[i].date)}</div></th>)}
                          <th className={`${th} text-center`}>Week</th>
                        </tr></thead>
                        <tbody><tr>
                          <td className="px-3 py-2 font-semibold text-zinc-100">{detail.client || r.client || '-'}</td>
                          <td className="px-3 py-2 text-zinc-300">{r.store}</td>
                          {detail.days.map((d) => <td key={d.date} className="px-3 py-2 text-center"><DayView d={d} onOpen={setModal} /></td>)}
                          <td className="px-3 py-2 text-center"><Cell cell={detail.week} onOpen={setModal} title="weekly report" /></td>
                        </tr></tbody>
                      </table>
                    )}
                    {detail && !detail.clientId && <p className="mt-2 text-[11px] text-amber-400">This store is not matched to a client with session reports, so the days stay empty.</p>}
                    <p className="mt-2 text-[10px] text-zinc-600">Days: ✓ = session reports sent to the client group (✓ 2/3: two of three logged were sent), ○ = logged by the advertiser and not sent yet.</p>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <Modal src={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
