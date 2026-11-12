'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { linkWaNumber, setWaGroupTracked } from '@/app/actions/wa';

const TABS = [
  { name: 'Dashboard', href: '/hrd/wa' },
  { name: 'Admin', href: '/hrd/wa/admin' },
  { name: 'Advertiser', href: '/hrd/wa/advertiser' },
  { name: 'Sales', href: '/hrd/wa/sales' },
];

/** WA Control sub pages: Dashboard | Admin | Advertiser | Sales. */
export function WaTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {TABS.map((t) => {
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
