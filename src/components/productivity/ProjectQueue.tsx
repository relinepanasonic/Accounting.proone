'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Loader2, UserCheck } from 'lucide-react';
import { assignProjectHandlers } from '@/app/actions/sales-flow';

export interface QueueProject {
  id: string;
  client_name: string;
  name: string;
  start_date: string;
  end_date: string | null;
  deliverables: { name: string; unit: string; total: number }[];
  status: string;
}
export interface QueueStaff {
  user_id: string;
  name: string;
  role: string;
}

const day = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '');
const select = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-200 focus:border-[#d4af37] focus:outline-none';

function Row({ p, staff }: { p: QueueProject; staff: QueueStaff[] }) {
  const router = useRouter();
  const [advertiser, setAdvertiser] = useState('');
  const [admin, setAdmin] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError('');
      const res = await assignProjectHandlers(p.id, advertiser || null, admin || null);
      if (!res.success) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="rounded-xl border border-[#d4af37]/25 bg-zinc-950/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-base font-bold text-zinc-100">{p.client_name}</div>
          <div className="text-xs text-zinc-500">{p.name}</div>
        </div>
        <div className="text-right text-xs text-zinc-400">
          <div className="flex items-center justify-end gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-[#d4af37]" /> {day(p.start_date)}{p.end_date ? ` → ${day(p.end_date)}` : ''}</div>
          {p.deliverables.length > 0 && <div>{p.deliverables.map((d) => `${d.total} ${d.unit}`).join(' · ')}</div>}
          <div className="uppercase tracking-wider text-[10px] text-zinc-600">{p.status === 'pre_start' ? 'starts later' : 'running'}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Advertiser
          <select className={select} value={advertiser} onChange={(e) => setAdvertiser(e.target.value)}>
            <option value="">Not needed / later</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name} ({s.role})</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Admin
          <select className={select} value={admin} onChange={(e) => setAdmin(e.target.value)}>
            <option value="">Not needed / later</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name} ({s.role})</option>)}
          </select>
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button onClick={save} disabled={pending || (!advertiser && !admin)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black disabled:opacity-40">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Assign
      </button>
    </div>
  );
}

/** New projects from the sales pipeline that nobody handles yet. Once assigned, the client appears on that person's page. */
export function ProjectQueue({ projects, staff }: { projects: QueueProject[]; staff: QueueStaff[] }) {
  if (projects.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#f5d77f]">New projects waiting for a handler ({projects.length})</h2>
      {projects.map((p) => <Row key={p.id} p={p} staff={staff} />)}
    </section>
  );
}
