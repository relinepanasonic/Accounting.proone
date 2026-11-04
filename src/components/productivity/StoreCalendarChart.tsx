'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchStoreCalendar } from '@/app/actions/advertiser';
import type { StoreCalendar } from '@/lib/advertiser/input-series';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const SESSIONS = ['1', '2', '3'];

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dow = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const dm = (d: string) => `${d.slice(8, 10)} ${MON[Number(d.slice(5, 7)) - 1]}`;

/** The Mondays of a month: a week belongs to the month of its Monday (31 Oct is a Monday, so 31 Oct - 6 Nov is a week of October). */
export function mondaysOf(year: number, month: number): string[] {
  const out: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    const k = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dow(k) === 0) out.push(k);
  }
  return out;
}

/** 25000 -> "25k", 27500 -> "27,5k", 1500000 -> "1,5jt". */
export const shortModal = (n: number) => {
  if (!n) return '-';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')}jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace('.', ',').replace(/,0$/, '')}k`;
  return String(Math.round(n));
};
export const oneDecimal = (n: number) => (n ? n.toFixed(1).replace('.', ',') : '-');

/** green = went up from the session before, red = went down, white = the same or the first one. */
const tone = (now: number, before: number | null) => (!now || before === null || before === now ? 'text-zinc-200' : now > before ? 'font-bold text-emerald-400' : 'font-bold text-red-400');

/** Which week is shown: the Monday of the picked week; else the latest week of the period that has numbers. */
export function pickWeek(cal: StoreCalendar, year: number, month: number, range: { from: string; to: string } | null): string {
  if (range && dow(range.from) === 0 && range.to === addDays(range.from, 6)) return range.from;
  const dates = Object.keys(cal.cells).filter((d) => (range ? d >= range.from && d <= range.to : d.startsWith(`${year}-`) && (!month || d.slice(5, 7) === String(month).padStart(2, '0')))).sort();
  const lastDay = dates[dates.length - 1];
  if (lastDay) return addDays(lastDay, -dow(lastDay));
  if (range) return addDays(range.from, -dow(range.from));
  const m = month || 1;
  const ms = mondaysOf(year, m);
  return ms[ms.length - 1] || `${year}-${String(m).padStart(2, '0')}-01`;
}

/** The calendar chart of a store: ads down the side, the days of one week (Mon - Sun) across, three sessions a day, each with Modal Harian | Target ROAS. */
export function StoreCalendarChart({ label, clientIds, year, month, range }: { label: string; clientIds: string[]; year: number; month: number; range: { from: string; to: string } | null }) {
  const [cals, setCals] = useState<Record<number, StoreCalendar | 'loading' | 'error'>>({});
  // A week from the Monday that starts it can reach into the next year: the year of the Monday is loaded.
  const needYear = range ? Number(range.from.slice(0, 4)) : year;
  const have = cals[needYear];
  useEffect(() => {
    if (cals[needYear]) return;
    let live = true;
    setCals((c) => ({ ...c, [needYear]: 'loading' }));
    fetchStoreCalendar(label, clientIds, needYear).then((res) => { if (live) setCals((c) => ({ ...c, [needYear]: res.data || 'error' })); }).catch(() => { if (live) setCals((c) => ({ ...c, [needYear]: 'error' })); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needYear, label]);

  const cal = have && typeof have === 'object' ? have : null;
  const monday = useMemo(() => (cal ? pickWeek(cal, year, month, range) : ''), [cal, year, month, range]);
  const days = monday ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : [];

  // What the ad was set to in the session before (the session before the first one of a day is the last one of an earlier day).
  const before = useMemo(() => {
    const out = new Map<string, { m: number | null; t: number | null }>();
    if (!cal || !monday) return out;
    for (const ad of cal.ads) {
      let prevM: number | null = null; let prevT: number | null = null;
      for (const d of Object.keys(cal.cells).sort()) {
        for (const s of SESSIONS) {
          const v = cal.cells[d]?.[s]?.[ad];
          if (!v) continue;
          out.set(`${d}|${s}|${ad}`, { m: prevM, t: prevT });
          prevM = v[0] || prevM; prevT = v[1] || prevT;
        }
      }
    }
    return out;
  }, [cal, monday]);

  const hasAny = cal && cal.ads.length > 0;
  const th = 'border-l border-zinc-800/80 px-1.5 py-1 text-center font-bold';
  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-extrabold text-white">Modal Harian | Target ROAS per session</span>
        <span className="text-[10px] text-zinc-500">{monday ? `${dm(monday)} - ${dm(addDays(monday, 6))} ${addDays(monday, 6).slice(0, 4)}` : ''} · <span className="text-emerald-400">up</span> / <span className="text-red-400">down</span> from the session before</span>
      </div>
      {have === 'loading' || !have ? <div className="py-10 text-center text-[11px] text-zinc-600">Loading...</div>
        : have === 'error' ? <div className="py-10 text-center text-[11px] text-red-400">Could not load the Input Log.</div>
        : !hasAny ? <div className="py-10 text-center text-[11px] text-zinc-600">No Modal Harian typed in the Input Log of this store in {needYear}.</div>
        : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="text-zinc-400">
                  <th rowSpan={2} className="sticky left-0 z-10 min-w-[130px] bg-[#0b0c10] px-2 py-1 text-left font-bold">Iklan</th>
                  {days.map((d, i) => <th key={d} colSpan={3} className={`${th} text-[11px] uppercase tracking-wider text-[#f5d77f]`}>{DAY[i]}</th>)}
                </tr>
                <tr className="text-zinc-500">
                  {days.map((d) => SESSIONS.map((s, k) => <th key={`${d}${s}`} className={`${th} font-semibold ${k === 0 ? '' : 'border-l-zinc-900'}`}>{k === 0 ? <div className="text-zinc-300">{dm(d)}</div> : null}Sesi {s}</th>))}
                </tr>
              </thead>
              <tbody>
                {cal!.ads.map((ad) => (
                  <tr key={ad} className="border-t border-zinc-900">
                    <td className="sticky left-0 z-10 max-w-[170px] truncate bg-[#0b0c10] px-2 py-1.5 font-bold text-zinc-200" title={ad}>{ad}</td>
                    {days.map((d) => SESSIONS.map((s) => {
                      const v = cal!.cells[d]?.[s]?.[ad];
                      const b = before.get(`${d}|${s}|${ad}`);
                      return (
                        <td key={`${d}${s}`} className="whitespace-nowrap border-l border-zinc-900 px-1.5 py-1.5 text-center font-mono">
                          {v ? <><span className={tone(v[0], b?.m ?? null)}>{shortModal(v[0])}</span><span className="px-1 text-zinc-700">|</span><span className={tone(v[1], b?.t ?? null)}>{oneDecimal(v[1])}</span></> : <span className="text-zinc-700">-</span>}
                        </td>
                      );
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
