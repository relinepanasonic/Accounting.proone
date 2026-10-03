'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Plus, Star } from 'lucide-react';
import { addTask, setTaskDone, setTaskStar } from '@/app/actions/planner';
import type { StaffTask } from '@/lib/productivity/planner';

type Tab = 'all' | 'today' | 'upcoming' | 'done';

const dueLabel = (due: string | null, today: string) => {
  if (!due) return '';
  if (due === today) return 'Today';
  const diff = Math.round((new Date(`${due}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${-diff}d late`;
  return new Date(`${due}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
};

/** My Tasks: tick a task off, star it, add one. Tasks given by a superadmin show who gave them. */
export function TasksWidget({ tasks, today, compact = false }: { tasks: StaffTask[]; today: string; compact?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'open');
    const list =
      tab === 'done' ? tasks.filter((t) => t.status === 'done')
      : tab === 'today' ? open.filter((t) => t.due_date !== null && t.due_date <= today)
      : tab === 'upcoming' ? open.filter((t) => t.due_date === null || t.due_date > today)
      : tasks;
    return [...list].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || Number(b.starred) - Number(a.starred) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  }, [tasks, tab, today]);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.success) setError(res.error || 'Could not save.');
      else router.refresh();
    });

  const submit = () =>
    start(async () => {
      setError('');
      const res = await addTask({ title, due_date: due || undefined });
      if (!res.success) return setError(res.error);
      setTitle('');
      setDue('');
      setAdding(false);
      router.refresh();
    });

  const TABS: [Tab, string][] = [['all', 'All'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['done', 'Completed']];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-zinc-100">My Tasks</h3>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-3 py-1.5 text-[11px] font-bold text-black"><Plus className="h-3.5 w-3.5" /> Add Task</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1 text-xs font-semibold ${tab === k ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-300'}`}>{label}</button>
        ))}
      </div>
      {adding && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && title.trim() && submit()} placeholder="What needs doing?" className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200 focus:border-[#d4af37] focus:outline-none" />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 [color-scheme:dark]" />
          <button onClick={submit} disabled={pending || !title.trim()} className="rounded-lg bg-[#d4af37]/20 px-3 py-1.5 text-xs font-bold text-[#f5d77f] disabled:opacity-40">Save</button>
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <ul className="divide-y divide-zinc-900">
        {shown.length === 0 && <li className="py-6 text-center text-xs text-zinc-600">{tab === 'done' ? 'Nothing completed yet.' : 'No tasks here.'}</li>}
        {shown.slice(0, compact ? 6 : 100).map((t) => {
          const done = t.status === 'done';
          const late = !done && t.due_date !== null && t.due_date < today;
          return (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <button disabled={pending} onClick={() => run(() => setTaskDone(t.id, !done))} aria-label={done ? 'Mark as not done' : 'Mark as done'} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-zinc-600 hover:border-[#d4af37]'}`}>
                {done && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm ${done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>{t.title}</div>
                {t.assigned_by && t.assigned_by !== t.assigned_to && <div className="truncate text-[10px] text-zinc-600">from {t.assigner_name}</div>}
              </div>
              <span className={`shrink-0 text-xs ${late ? 'text-red-300' : 'text-zinc-500'}`}>{dueLabel(t.due_date, today)}</span>
              <button disabled={pending} onClick={() => run(() => setTaskStar(t.id, !t.starred))} aria-label={t.starred ? 'Remove star' : 'Star'} className={t.starred ? 'text-[#f5d77f]' : 'text-zinc-700 hover:text-zinc-400'}>
                <Star className="h-4 w-4" fill={t.starred ? 'currentColor' : 'none'} />
              </button>
            </li>
          );
        })}
      </ul>
      {compact && shown.length > 6 && <Link href="/productivity/tasks" className="mt-2 text-xs font-bold text-[#f5d77f] hover:underline">See all {shown.length} tasks</Link>}
    </div>
  );
}
