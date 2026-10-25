'use client';

import React, { useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';

export interface DateRange { from: string; to: string }

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** "2026-10-01" -> "01 Okt 2026". */
export const dmy = (d: string) => (d ? `${d.slice(8, 10)} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '');
export const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export const shift = (d: string, days: number) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export function Month({ y, m, start, end, hover, onPick, onHover }: { y: number; m: number; start: string; end: string; hover: string; onPick: (d: string) => void; onHover: (d: string) => void }) {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday first
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: Array<string | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1))];
  // While the end is not chosen yet, the hovered day previews the range.
  const to = end || (start && hover >= start ? hover : '');
  return (
    <div className="w-[224px]">
      <div className="mb-2 text-center text-xs font-bold text-white">{FULL[m]} {y}</div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-500">{DOW.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isStart = d === start; const isEnd = d === to && !!start;
          const inside = !!start && !!to && d > start && d < to;
          return (
            <button
              key={d} type="button" onClick={() => onPick(d)} onMouseEnter={() => onHover(d)}
              className={`h-8 text-[11px] font-semibold transition-colors ${
                isStart || isEnd ? 'rounded-md bg-[#d4af37] text-black' : inside ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'rounded-md text-zinc-300 hover:bg-zinc-800'
              } ${d === today() && !isStart && !isEnd ? 'ring-1 ring-[#d4af37]/40' : ''}`}
            >
              {Number(d.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A small calendar (like Shopee's): click the first day, then the last day, then Apply. */
export function DateRangePicker({ value, onApply, buttonClass }: { value: DateRange | null; onApply: (r: DateRange | null) => void; buttonClass: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(value?.from || '');
  const [end, setEnd] = useState(value?.to || '');
  const [hover, setHover] = useState('');
  const base = value?.from || today();
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });

  const pick = (d: string) => {
    if (!start || end) { setStart(d); setEnd(''); return; } // a new range begins
    if (d < start) { setStart(d); return; }
    setEnd(d);
  };
  const move = (n: number) => setView((v) => { const t = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; });
  const second = new Date(Date.UTC(view.y, view.m + 1, 1));
  const preset = (a: string, b: string) => { setStart(a); setEnd(b); const d = new Date(`${a}T00:00:00Z`); setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() }); };
  const t = today();
  const apply = () => { if (!start) return; setOpen(false); onApply({ from: start, to: end || start }); };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${buttonClass} flex items-center gap-2 ${value ? 'border-[#d4af37]/60 text-[#d4af37]' : ''}`} aria-label="Date range">
        <CalendarRange className="h-3.5 w-3.5" />{value ? (value.from === value.to ? dmy(value.from) : `${dmy(value.from)} - ${dmy(value.to)}`) : 'Date range'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-2 max-w-[calc(100vw-2rem)] rounded-xl border border-[#d4af37]/30 bg-[#0e0f14] p-4 shadow-2xl" onMouseLeave={() => setHover('')}>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {([
                ['Yesterday', shift(t, -1), shift(t, -1)], ['Last 7 days', shift(t, -7), shift(t, -1)], ['Last 30 days', shift(t, -30), shift(t, -1)],
                ['This month', `${t.slice(0, 8)}01`, t],
              ] as const).map(([label, a, b]) => (
                <button key={label} type="button" onClick={() => preset(a, b)} className="rounded-md border border-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-400 hover:border-[#d4af37]/40 hover:text-[#d4af37]">{label}</button>
              ))}
            </div>
            <div className="flex items-start gap-4">
              <button type="button" onClick={() => move(-1)} className="mt-0.5 rounded-md p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
              <Month y={view.y} m={view.m} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
              <div className="hidden sm:block"><Month y={second.getUTCFullYear()} m={second.getUTCMonth()} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} /></div>
              <button type="button" onClick={() => move(1)} className="mt-0.5 rounded-md p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-800 pt-3">
              <span className="text-[11px] text-zinc-400">{start ? `${dmy(start)} - ${end ? dmy(end) : 'pick the last day'}` : 'Pick the first day'}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setOpen(false); setStart(''); setEnd(''); onApply(null); }} className="rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white">Clear</button>
                <button type="button" disabled={!start} onClick={apply} className="rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1.5 text-xs font-bold text-[#d4af37] disabled:opacity-40">Apply</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
