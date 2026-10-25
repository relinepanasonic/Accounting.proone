'use client';

import React, { useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { Month, MONTHS, FULL, dmy, shift, today, type DateRange } from '@/components/ui/DateRangePicker';

/** What the viewer picked: a whole year, a whole month, or a range of days (a week and the shortcuts are ranges too). */
export type Period = { year: number; month: number } | { range: DateRange };

type Mode = 'day' | 'week' | 'month' | 'year';

const mondayOf = (d: string) => { const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; return shift(d, -dow); };

/**
 * One "Period" button like Shopee's: shortcuts and the kind of period on the left (Per Day, Per Week, Per Month, Per Year),
 * the calendar for it on the right. A range is picked by clicking its first and last day, then Apply.
 */
export function PeriodPicker({ year, month, range, years, onPick, buttonClass }: {
  year: number; month: number; range: DateRange | null; years: number[]; onPick: (p: Period) => void; buttonClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(range ? 'day' : month ? 'month' : 'year');
  const [start, setStart] = useState(range?.from || '');
  const [end, setEnd] = useState(range?.to || '');
  const [hover, setHover] = useState('');
  const [pickYear, setPickYear] = useState(year);
  const base = range?.from || `${year}-${String(month || 1).padStart(2, '0')}-01`;
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  const t = today();

  const label = range
    ? (range.from === range.to ? dmy(range.from) : `${dmy(range.from)} - ${dmy(range.to)}`)
    : month ? `${FULL[month - 1]} ${year}` : String(year);

  const apply = (p: Period) => { setOpen(false); onPick(p); };
  const move = (n: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const second = new Date(Date.UTC(view.y, view.m + 1, 1));
  const pickDay = (d: string) => {
    if (mode === 'week') { const mon = mondayOf(d); apply({ range: { from: mon, to: shift(mon, 6) } }); return; }
    if (!start || end) { setStart(d); setEnd(''); return; } // a new range begins
    if (d < start) { setStart(d); return; }
    setEnd(d);
  };
  const shortcuts: Array<[string, string, string]> = [['Yesterday', shift(t, -1), shift(t, -1)], ['Last 7 days', shift(t, -7), shift(t, -1)], ['Last 30 days', shift(t, -30), shift(t, -1)]];
  const modes: Array<[Mode, string]> = [['day', 'Per Day'], ['week', 'Per Week'], ['month', 'Per Month'], ['year', 'Per Year']];
  const item = (on: boolean) => `flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-semibold ${on ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-zinc-300 hover:bg-zinc-800'}`;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${buttonClass} flex items-center gap-2 border-[#d4af37]/40`} aria-label="Period">
        <span className="font-normal text-zinc-500">Period</span><span className="text-[#d4af37]">{label}</span><CalendarRange className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-2 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[#d4af37]/30 bg-[#0e0f14] shadow-2xl sm:flex-row" onMouseLeave={() => setHover('')}>
            <div className="w-full shrink-0 space-y-0.5 border-b border-zinc-800 p-2 sm:w-44 sm:border-b-0 sm:border-r">
              {shortcuts.map(([name, a, b]) => <button key={name} type="button" onClick={() => apply({ range: { from: a, to: b } })} className={item(range?.from === a && range?.to === b)}>{name}</button>)}
              <div className="my-1 border-t border-zinc-800" />
              {modes.map(([k, name]) => <button key={k} type="button" onClick={() => setMode(k)} className={item(mode === k)}>{name}<ChevronRight className="h-3.5 w-3.5 opacity-60" /></button>)}
            </div>

            <div className="p-4">
              {(mode === 'day' || mode === 'week') && (
                <>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => move(-1)} className="mt-0.5 rounded-md p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                    <Month y={view.y} m={view.m} start={start} end={end} hover={hover} onPick={pickDay} onHover={setHover} />
                    {mode === 'day' && <div className="hidden sm:block"><Month y={second.getUTCFullYear()} m={second.getUTCMonth()} start={start} end={end} hover={hover} onPick={pickDay} onHover={setHover} /></div>}
                    <button type="button" onClick={() => move(1)} className="mt-0.5 rounded-md p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-800 pt-3">
                    <span className="text-[11px] text-zinc-400">{mode === 'week' ? 'Click a day: its week (Mon - Sun) is used' : start ? `${dmy(start)} - ${end ? dmy(end) : 'pick the last day'}` : 'Pick the first day'}</span>
                    {mode === 'day' && <button type="button" disabled={!start} onClick={() => apply({ range: { from: start, to: end || start } })} className="rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1.5 text-xs font-bold text-[#d4af37] disabled:opacity-40">Apply</button>}
                  </div>
                </>
              )}

              {mode === 'month' && (
                <div className="w-64">
                  <div className="mb-3 flex items-center justify-between">
                    <button type="button" onClick={() => setPickYear((y) => y - 1)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-xs font-bold text-white">{pickYear}</span>
                    <button type="button" onClick={() => setPickYear((y) => y + 1)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {MONTHS.map((m, i) => (
                      <button key={m} type="button" onClick={() => apply({ year: pickYear, month: i + 1 })} className={`rounded-lg border px-2 py-2 text-xs font-bold ${!range && month === i + 1 && year === pickYear ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-zinc-800 text-zinc-300 hover:border-[#d4af37]/40'}`}>{m}</button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'year' && (
                <div className="grid w-64 grid-cols-3 gap-2">
                  {years.map((y) => (
                    <button key={y} type="button" onClick={() => apply({ year: y, month: 0 })} className={`rounded-lg border px-2 py-2 text-xs font-bold ${!range && !month && year === y ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-zinc-800 text-zinc-300 hover:border-[#d4af37]/40'}`}>{y}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
