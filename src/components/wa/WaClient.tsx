'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { linkWaNumber, setWaGroupTracked, renameWaGroup, generateWaReportNow, setWaActionStatus, convertWaActionToTask, syncWaGroups } from '@/app/actions/wa';

const TABS = [
  { name: 'Dashboard', href: '/hrd/wa' },
  { name: 'Admin', href: '/hrd/wa/admin' },
  { name: 'Advertiser', href: '/hrd/wa/advertiser' },
  { name: 'Sales', href: '/hrd/wa/sales' },
];

/** WA Control sub pages: Dashboard | Admin | Advertiser | Sales. */
export function WaTabs({ showFounder = false }: { showFounder?: boolean }) {
  const pathname = usePathname();
  const tabs = showFounder ? [...TABS, { name: 'Founder', href: '/hrd/wa/founder' }] : TABS;
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.href === '/hrd/wa' ? pathname === '/hrd/wa' : pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              active ? 'border-[#d4af37]/50 bg-[#d4af37]/20 text-[#f5d77f]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </div>
  );
}

/** Period + group + search, kept in the URL so a view can be shared and survives a refresh. */
export function WaFilters({ groups, days, groupId, q }: { groups: { id: string; name: string }[]; days: number; groupId: string; q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [text, setText] = useState(q);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v); else n.delete(k);
    router.push(`${pathname}?${n.toString()}`);
  };
  const box = 'rounded-md border border-zinc-800 bg-[#0e0f14] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-[#d4af37]/50 focus:outline-none';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={box} value={days} onChange={(e) => set('days', e.target.value === '1' ? '' : e.target.value)}>
        <option value="1">Last 24 hours</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
      </select>
      <select className={box} value={groupId} onChange={(e) => set('group', e.target.value)}>
        <option value="">All chats</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <form onSubmit={(e) => { e.preventDefault(); set('q', text.trim()); }} className="flex">
        <input className={`${box} w-48`} placeholder="Search messages..." value={text} onChange={(e) => setText(e.target.value)} />
      </form>
    </div>
  );
}

/** Link a WhatsApp number we have seen to an ERP person (or leave it as not staff). */
export function LinkNumber({ phone, name, people }: { phone: string; name: string; people: { userId: string; name: string; role: string }[] }) {
  const [pending, start] = useTransition();
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="flex items-center gap-2">
      <select
        className="max-w-[11rem] rounded-md border border-zinc-800 bg-[#0e0f14] px-2 py-1 text-xs text-zinc-200"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      >
        <option value="">Pick a person...</option>
        {people.map((p) => <option key={p.userId} value={p.userId}>{p.name} ({p.role})</option>)}
      </select>
      <button
        disabled={!val || pending}
        onClick={() => start(async () => { const r: any = await linkWaNumber(phone, val, name); setErr(r?.error || ''); })}
        className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-2.5 py-1 text-xs font-bold text-[#f5d77f] disabled:opacity-40"
      >
        {pending ? '...' : 'Link'}
      </button>
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </div>
  );
}

export function TrackToggle({ groupId, tracked }: { groupId: string; tracked: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await setWaGroupTracked(groupId, !tracked); })}
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${tracked ? 'border-emerald-500/40 text-emerald-300' : 'border-zinc-700 text-zinc-500'}`}
    >
      {tracked ? 'Reporting' : 'Muted'}
    </button>
  );
}

/** Click a chat name to rename it (Fonnte does not send group names). */
export function RenameGroup({ groupId, name, fallback }: { groupId: string; name: string | null; fallback: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name || '');
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <button onClick={() => { setVal(name || ''); setEditing(true); }} title="Rename" className="max-w-full truncate text-left text-zinc-200 hover:text-[#f5d77f]">
        {name || fallback} <span className="text-[10px] text-zinc-600">✎</span>
      </button>
    );
  }
  const save = () => start(async () => { await renameWaGroup(groupId, val); setEditing(false); });
  return (
    <input
      autoFocus
      value={val}
      disabled={pending}
      maxLength={80}
      placeholder={fallback}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      className="w-full rounded border border-[#d4af37]/50 bg-[#0e0f14] px-2 py-0.5 text-xs text-zinc-100 focus:outline-none"
    />
  );
}

/** Writes today's reports now (the same job the 18:00 cron runs). Takes up to a minute or two. */
export function GenerateReport() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() => start(async () => {
          setMsg('');
          const r: any = await generateWaReportNow();
          if (r?.error) setMsg(r.error);
          else setMsg(`${r.run.groups} chat report(s)${r.run.digest ? ' + digest' : ''}, ${r.run.items} follow-up(s)${r.run.skipped ? `, ${r.run.skipped} chat(s) too quiet` : ''}${r.run.errors.length ? `. Problems: ${r.run.errors.join('; ')}` : '.'}`);
        })}
        className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-3 py-1.5 text-xs font-bold text-[#f5d77f] disabled:opacity-50"
      >
        {pending ? 'Writing reports... (up to 2 min)' : 'Generate now'}
      </button>
      {msg && <span className="text-[11px] text-zinc-400">{msg}</span>}
    </div>
  );
}

/** One follow-up: mark done, dismiss, or turn it into an ERP task. */
export function ActionRow({ id, hasTask }: { id: string; hasTask: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState('');
  const btn = 'rounded border border-zinc-700 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-300 hover:border-[#d4af37]/50 hover:text-[#f5d77f] disabled:opacity-40';
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {hasTask ? <span className="text-[10px] font-bold uppercase text-emerald-400">Task created</span> : (
        <button disabled={pending} className={btn} onClick={() => start(async () => { const r: any = await convertWaActionToTask(id); setNote(r?.error || (r?.assignedToYou ? 'Assigned to you (no owner matched)' : '')); })}>Make task</button>
      )}
      <button disabled={pending} className={btn} onClick={() => start(async () => { await setWaActionStatus(id, 'done'); })}>Done</button>
      <button disabled={pending} className={btn} onClick={() => start(async () => { await setWaActionStatus(id, 'dismissed'); })}>Dismiss</button>
      {note && <span className="text-[10px] text-amber-400">{note}</span>}
    </div>
  );
}

/** Fills the chat list from Fonnte (every group Oli is in, with its name). The second button refreshes Fonnte's own list first. */
export function SyncGroups() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const run = (refresh: boolean) => start(async () => {
    setMsg(refresh ? 'Refreshing from WhatsApp...' : 'Asking Fonnte...');
    const r: any = await syncWaGroups(refresh);
    setMsg(r?.error ? `Problem: ${r.error}` : `Fonnte lists ${r.found} group(s): ${r.created} new, ${r.named} named.`);
  });
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button disabled={pending} className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-2.5 py-1 text-[11px] font-bold text-[#f5d77f] disabled:opacity-50" onClick={() => run(false)}>{pending ? 'Working...' : 'Sync groups from Fonnte'}</button>
      <button disabled={pending} className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:border-[#d4af37]/50 disabled:opacity-50" title="Fonnte asks WhatsApp for the current group list. Use it only after Oli joined a new group: overusing it can get the number banned." onClick={() => { if (confirm('Refresh the group list from WhatsApp? Use this only after Oli has joined a new group; overusing it can get the number banned.')) run(true); }}>Refresh from WhatsApp</button>
      {msg && <span className="w-full text-right text-[10px] text-zinc-400">{msg}</span>}
    </div>
  );
}
