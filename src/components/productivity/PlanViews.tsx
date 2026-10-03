import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Flame, ListChecks, Plus } from 'lucide-react';
import { addDays } from '@/lib/kpi/calendar';

const at = (day: string) => new Date(`${day}T12:00:00Z`);

/** "Good Morning," + the person's name in gold, with their initials on the right. */
export function PlanHeader({ name, subtitle }: { name: string; subtitle?: string }) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()));
  const greeting = hour < 11 ? 'Good Morning' : hour < 15 ? 'Good Afternoon' : hour < 19 ? 'Good Evening' : 'Good Night';
  const first = (name || '').split(/[\s.@]/)[0] || 'there';
  const initials = (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-start justify-between gap-4 pr-12">
      <div>
        <p className="text-sm text-zinc-400">{greeting},</p>
        <h1 className="font-serif text-3xl font-extrabold text-zinc-100">
          <span className="bg-gradient-to-r from-[#d4af37] to-[#f5d77f] bg-clip-text text-transparent">{first}</span> <span aria-hidden>👋</span>
        </h1>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#8a6d1a] text-sm font-extrabold text-black shadow-[0_0_18px_rgba(212,175,55,0.35)]">{initials}</div>
    </div>
  );
}

/** Seven days around the selected one; tapping a day opens its plan. */
export function DateStrip({ selected, today, base }: { selected: string; today: string; base: string }) {
  const days = Array.from({ length: 7 }).map((_, i) => addDays(selected, i - 3));
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Pick a day">
      {days.map((d) => {
        const on = d === selected;
        const letter = at(d).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'narrow' });
        return (
          <Link
            key={d}
            href={`${base}?date=${d}`}
            scroll={false}
            className={`flex min-w-[48px] flex-1 flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-colors ${on ? 'border-[#d4af37]/50 bg-[#d4af37]/10' : 'border-transparent hover:bg-zinc-900'}`}
          >
            <span className={`text-[11px] font-semibold ${on ? 'text-[#f5d77f]' : 'text-zinc-500'}`}>{letter}</span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${on ? 'bg-gradient-to-br from-[#d4af37] to-[#f5d77f] text-black shadow-[0_0_14px_rgba(212,175,55,0.4)]' : 'text-zinc-300'}`}>{Number(d.slice(8))}</span>
            <span className={`h-1 w-1 rounded-full ${d === today ? 'bg-[#d4af37]' : 'bg-transparent'}`} />
          </Link>
        );
      })}
    </div>
  );
}

/** Total / Done / Pending / Urgent. */
export function StatTiles({ stats }: { stats: { total: number; done: number; pending: number; urgent: number } }) {
  const tiles = [
    { label: 'Total', value: stats.total, icon: <ListChecks className="h-5 w-5 text-[#f5d77f]" />, cls: 'border-zinc-800' },
    { label: 'Done', value: stats.done, icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />, cls: 'border-emerald-500/20' },
    { label: 'Pending', value: stats.pending, icon: <Clock className="h-5 w-5 text-amber-400" />, cls: 'border-amber-500/25' },
    { label: 'Urgent', value: stats.urgent, icon: <Flame className="h-5 w-5 text-red-400" />, cls: stats.urgent ? 'border-red-500/35' : 'border-zinc-800' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {tiles.map((t) => (
        <div key={t.label} className={`flex flex-col items-center gap-1 rounded-2xl border bg-[#0e0f14] px-2 py-3.5 ${t.cls}`}>
          {t.icon}
          <div className="text-2xl font-extrabold text-zinc-100">{t.value}</div>
          <div className="text-[11px] text-zinc-500">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Round gold "+" for the main action of the role (new session report, upload, new lead...). */
export function QuickAddButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5d77f] text-black shadow-[0_8px_28px_rgba(212,175,55,0.45)] transition-transform hover:scale-105 lg:bottom-8 lg:right-8"
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </Link>
  );
}

/** Month grid; a dot marks a day with something on it. */
export function MonthGrid({ month, selected, today, marked, base }: { month: string; selected: string; today: string; marked: Set<string>; base: string }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const lead = first.getUTCDay(); // Sunday first, like the reference
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => new Date(Date.UTC(y, m - 1 + n, 1, 12)).toISOString().slice(0, 7);
  const label = first.toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });

  return (
    <div className="rounded-3xl border border-zinc-800 bg-[#0e0f14] p-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`${base}?month=${shift(-1)}`} scroll={false} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d4af37]/10 text-[#f5d77f] hover:bg-[#d4af37]/20"><ChevronLeft className="h-5 w-5" /></Link>
        <span className="text-base font-bold text-zinc-100">{label}</span>
        <Link href={`${base}?month=${shift(1)}`} scroll={false} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d4af37]/10 text-[#f5d77f] hover:bg-[#d4af37]/20"><ChevronRight className="h-5 w-5" /></Link>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-zinc-500">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => <div key={w} className="pb-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const on = d === selected;
          return (
            <Link key={d} href={`${base}?month=${month}&date=${d}`} scroll={false} className="flex flex-col items-center py-1">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${on ? 'bg-gradient-to-br from-[#d4af37] to-[#f5d77f] font-extrabold text-black shadow-[0_0_14px_rgba(212,175,55,0.4)]' : d === today ? 'border border-[#d4af37]/60 font-bold text-[#f5d77f]' : 'text-zinc-200 hover:bg-zinc-900'}`}>{Number(d.slice(8))}</span>
              <span className={`mt-0.5 h-1 w-1 rounded-full ${marked.has(d) ? (on ? 'bg-[#f5d77f]' : 'bg-[#d4af37]') : 'bg-transparent'}`} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
