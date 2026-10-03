'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, UserPlus } from 'lucide-react';
import { addTask, deleteTask } from '@/app/actions/planner';
import type { StaffTask } from '@/lib/productivity/planner';

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-[#d4af37] focus:outline-none [color-scheme:dark]';

/** Superadmin: give a task to someone. */
export function AssignTaskForm({ staff, meId }: { staff: { id: string; name: string; role: string }[]; meId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [who, setWho] = useState(meId);
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError('');
      setOk('');
      const res = await addTask({ title, note, due_date: due || undefined, priority, assigned_to: who });
      if (!res.success) return setError(res.error);
      setOk(who === meId ? 'Task added to your list.' : 'Task assigned. The person was notified.');
      setTitle('');
      setNote('');
      setDue('');
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The task" className={`${field} sm:col-span-2`} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Details (optional)" className={`${field} sm:col-span-2`} />
        <select value={who} onChange={(e) => setWho(e.target.value)} className={field}>
          <option value={meId}>Me</option>
          {staff.filter((s) => s.id !== meId).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
        </select>
        <div className="flex gap-2">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className={`${field} flex-1`} />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority" className={field}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={pending || !title.trim()} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-4 py-2 text-xs font-extrabold text-black disabled:opacity-40"><UserPlus className="h-4 w-4" /> Assign</button>
        {error && <span className="text-xs text-red-400">{error}</span>}
        {ok && <span className="text-xs text-emerald-300">{ok}</span>}
      </div>
    </div>
  );
}

const PRIORITY = { high: 'border-red-500/40 bg-red-500/10 text-red-300', medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300', low: 'border-sky-500/30 bg-sky-500/10 text-sky-300' };

/** Superadmin: everyone's tasks, grouped by person. */
export function TeamTasks({ tasks, today }: { tasks: StaffTask[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const byPerson = new Map<string, StaffTask[]>();
  for (const t of tasks) (byPerson.get(t.assignee_name) || byPerson.set(t.assignee_name, []).get(t.assignee_name)!).push(t);
  const people = Array.from(byPerson.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (people.length === 0) return <p className="py-6 text-center text-xs text-zinc-600">No tasks yet.</p>;
  return (
    <div className="space-y-5">
      {people.map(([name, list]) => {
        const open = list.filter((t) => t.status === 'open');
        return (
          <div key={name}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-100">{name}</span>
              <span className="text-[11px] text-zinc-500">{open.length} open · {list.length - open.length} done</span>
            </div>
            <ul className="divide-y divide-zinc-900 rounded-xl border border-zinc-800 bg-black/20">
              {open.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold capitalize ${PRIORITY[t.priority]}`}>{t.priority}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{t.title}</span>
                  <span className={`shrink-0 text-xs ${t.due_date && t.due_date < today ? 'text-red-300' : 'text-zinc-500'}`}>{t.due_date || 'no date'}</span>
                  <button disabled={pending} onClick={() => start(async () => { await deleteTask(t.id); router.refresh(); })} aria-label="Delete task" className="text-zinc-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
              {open.length === 0 && <li className="px-3 py-2 text-xs text-zinc-600">Nothing open.</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
