'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Flame, Megaphone, Shield, TrendingUp, Users, Wallet } from 'lucide-react';
import type { CalendarEvent, PlanCategory, PlanTask } from '@/lib/productivity/plan';

const TONE: Record<PlanCategory, { bar: string; chip: string; text: string; icon: React.ReactNode }> = {
  Advertising: { bar: 'bg-[#d4af37]', chip: 'border-[#d4af37]/30 bg-[#d4af37]/10 text-[#f5d77f]', text: 'text-[#f5d77f]', icon: <Megaphone className="h-3 w-3" /> },
  Admin: { bar: 'bg-sky-400', chip: 'border-sky-400/30 bg-sky-400/10 text-sky-300', text: 'text-sky-300', icon: <Shield className="h-3 w-3" /> },
  Sales: { bar: 'bg-emerald-400', chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', text: 'text-emerald-300', icon: <TrendingUp className="h-3 w-3" /> },
  Finance: { bar: 'bg-violet-400', chip: 'border-violet-400/30 bg-violet-400/10 text-violet-300', text: 'text-violet-300', icon: <Wallet className="h-3 w-3" /> },
  Team: { bar: 'bg-rose-400', chip: 'border-rose-400/30 bg-rose-400/10 text-rose-300', text: 'text-rose-300', icon: <Users className="h-3 w-3" /> },
};

export function PlanCard({ task }: { task: PlanTask }) {
  const t = TONE[task.category];
  const pct = task.progress && task.progress.total ? Math.round((task.progress.done / task.progress.total) * 100) : null;
  return (
    <Link
      href={task.href}
      className={`group relative flex gap-3 overflow-hidden rounded-2xl border bg-[#0e0f14] p-4 pl-5 transition-colors hover:border-[#d4af37]/50 ${task.urgent && !task.done ? 'border-red-500/30' : 'border-zinc-800'}`}
    >
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${t.bar} ${task.done ? 'opacity-40' : ''}`} />
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${task.done ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-zinc-600'}`} aria-hidden>
        {task.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className={`truncate text-[15px] font-bold ${task.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{task.title}</div>
          {task.urgent && !task.done && <Flame className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-label="Urgent" />}
        </div>
        {task.subtitle && <div className="mt-0.5 truncate text-xs text-zinc-500">{task.subtitle}</div>}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.chip}`}>{t.icon} {task.category}</span>
          {task.slots && task.slots.map((on, i) => (
            <span key={i} title={`Session ${i + 1}${on ? ' saved' : ' missing'}`} className={`flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-bold ${on ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
              {on ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
          ))}
          {task.note && <span className={`text-[11px] ${task.urgent && !task.done ? 'text-red-300' : 'text-zinc-500'}`}>{task.note}</span>}
          <ChevronRight className="ml-auto h-4 w-4 text-zinc-700 transition-colors group-hover:text-[#d4af37]" />
        </div>
        {pct !== null && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`font-mono text-[10px] font-bold ${t.text}`}>{task.progress!.done}/{task.progress!.total}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function EventCard({ event }: { event: CalendarEvent }) {
  const t = TONE[event.category];
  return (
    <Link href={event.href} className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0e0f14] p-4 pl-5 hover:border-[#d4af37]/50">
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${t.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-zinc-100">{event.title}</div>
        <div className="mt-0.5 truncate text-xs text-zinc-500">{event.subtitle}</div>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.chip}`}>{t.icon} {event.category}</span>
    </Link>
  );
}

type Filter = 'all' | 'pending' | 'done' | 'urgent';

/** Today's Plan: the task cards with All / Pending / Done / Urgent filters. */
export function PlanList({ tasks, title = "Today's Plan", emptyText = 'Nothing planned for this day.' }: { tasks: PlanTask[]; title?: string; emptyText?: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const counts = useMemo(
    () => ({ all: tasks.length, pending: tasks.filter((t) => !t.done).length, done: tasks.filter((t) => t.done).length, urgent: tasks.filter((t) => t.urgent && !t.done).length }),
    [tasks]
  );
  const shown = tasks.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : filter === 'urgent' ? t.urgent && !t.done : !t.done));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-extrabold text-zinc-100">{title}</h2>
        <div className="inline-flex overflow-hidden rounded-full border border-zinc-800 bg-[#0e0f14] p-0.5 text-[11px] font-bold">
          {(['all', 'pending', 'done', 'urgent'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 capitalize transition-colors ${filter === f ? 'bg-gradient-to-r from-[#d4af37] to-[#f5d77f] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {f} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{tasks.length === 0 ? emptyText : 'Nothing in this view.'}</div>
      ) : (
        <div className="space-y-3">{shown.map((t) => <PlanCard key={t.id} task={t} />)}</div>
      )}
    </section>
  );
}
