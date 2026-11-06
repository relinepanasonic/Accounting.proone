'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Check, Plus, UserRound } from 'lucide-react';
import type { ClientRow } from '@/lib/sales/client-table';
import { updateClientContact, createClientContact } from '@/app/actions/sales-flow';
import { SortArrows } from '@/components/ui/SortArrows';
import { StoreCell, type StoreLine } from '@/components/sales/ClientStoreTable';

export interface ContactRow { clientId: string; name: string; brand: string; pic: string; row: ClientRow }

const AVATAR = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#f87171', '#2dd4bf'];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const colorOf = (name: string) => AVATAR[Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR.length];

const quiet = 'w-full truncate rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 hover:border-zinc-700 focus:border-[#d4af37]/60 focus:bg-zinc-900 focus:outline-none';

/** A box that looks like plain text until you hover it. It saves when you leave it (Tab, Enter or a click away) and flashes a check. */
function EditCell({ clientId, kind, value, canEdit, placeholder }: { clientId: string; kind: 'name' | 'brand' | 'pic'; value: string; canEdit: boolean; placeholder: string }) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => setText(value), [value]);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1400); return () => clearTimeout(t); }, [done]);
  if (!canEdit) return <span className="px-2 text-sm text-zinc-200">{value || <span className="text-zinc-600">-</span>}</span>;
  const save = () => {
    const next = text.trim();
    if (next === value.trim()) return;
    if (kind === 'name' && !next) { setText(value); setError('The company name cannot be empty.'); return; }
    setError('');
    start(async () => {
      const res = await updateClientContact(clientId, { [kind]: next });
      if (!res.success) { setError(res.error); setText(value); return; }
      setDone(true);
      router.refresh();
    });
  };
  return (
    <div className="relative">
      <input
        value={text}
        placeholder={placeholder}
        title={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setText(value); (e.target as HTMLInputElement).blur(); } }}
        className={`${quiet} ${kind === 'name' ? 'font-bold text-white' : ''} ${pending ? 'opacity-60' : ''} pr-7`}
      />
      {done && <Check className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-400" />}
      {error && <div className="mt-0.5 px-2 text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

function AddClient() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [pic, setPic] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const save = () => {
    setError('');
    start(async () => {
      const res = await createClientContact({ name, brand, pic });
      if (!res.success) { setError(res.error); return; }
      setName(''); setBrand(''); setPic(''); setOpen(false);
      router.refresh();
    });
  };
  const box = 'rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3.5 py-2 text-xs font-bold text-[#f5d77f] hover:brightness-125"><Plus className="h-4 w-4" /> New client</button>;
  return (
    <div className="w-full rounded-xl border border-[#d4af37]/30 bg-zinc-950/70 p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">New client</div>
      <div className="flex flex-wrap items-start gap-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name *" autoFocus className={`${box} w-64`} />
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" className={`${box} w-52`} />
        <input value={pic} onChange={(e) => setPic(e.target.value)} placeholder="PIC name" className={`${box} w-52`} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <button type="button" disabled={pending || !name.trim()} onClick={save} className="rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40">{pending ? 'Saving...' : 'Save client'}</button>
        <button type="button" onClick={() => { setOpen(false); setError(''); }} className="px-2 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Add its stores after saving, in the Store Name column.</p>
      {error && <div className="mt-2 text-[11px] text-red-400">{error}</div>}
    </div>
  );
}

type Filter = 'all' | 'nostore' | 'nopic' | 'nobrand';

/**
 * Accounting > Client Contact: Company Name | Brand Name | Store Name | PIC Name for every client. It is the same client data as
 * Optimizing > Clients (one source), so a change made in either place is the other's too.
 */
export function ClientContactTable({ rows, canEdit, storeOptions }: { rows: ContactRow[]; canEdit: boolean; storeOptions?: string[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<{ key: 'name' | 'brand' | 'store' | 'pic'; asc: boolean }>({ key: 'name', asc: true });
  const q = search.trim().toLowerCase();

  const counts = useMemo(() => ({
    all: rows.length,
    nostore: rows.filter((r) => !(r.row.stores || []).length).length,
    nopic: rows.filter((r) => !r.pic.trim()).length,
    nobrand: rows.filter((r) => !r.brand.trim()).length,
  }), [rows]);

  const shown = useMemo(() => {
    const storeText = (r: ContactRow) => (r.row.stores || []).map((s) => `${s.company} ${s.store}`).join(' ');
    const list = rows.filter((r) => {
      if (filter === 'nostore' && (r.row.stores || []).length) return false;
      if (filter === 'nopic' && r.pic.trim()) return false;
      if (filter === 'nobrand' && r.brand.trim()) return false;
      return !q || [r.name, r.brand, r.pic, storeText(r)].some((t) => t.toLowerCase().includes(q));
    });
    const val = (r: ContactRow) => (sort.key === 'name' ? r.name : sort.key === 'brand' ? r.brand : sort.key === 'pic' ? r.pic : (r.row.stores || []).map((s) => s.store).join(' ')).toLowerCase();
    return list.sort((a, b) => val(a).localeCompare(val(b), 'id', { numeric: true }) * (sort.asc ? 1 : -1));
  }, [rows, q, sort, filter]);

  const Th = ({ k, children, w }: { k: typeof sort.key; children: React.ReactNode; w: string }) => (
    <th className="px-3 py-3 font-bold" style={{ width: w }}>
      <button onClick={() => setSort((p) => (p.key === k ? { key: k, asc: !p.asc } : { key: k, asc: true }))} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>
        {children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} />
      </button>
    </th>
  );
  const pill = (k: Filter, label: string) => (
    <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === k ? 'border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f5d77f]' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
      {label} <span className="ml-1 font-mono text-[10px] opacity-70">{counts[k]}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, brand, store or PIC" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/50 focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">{pill('all', 'All')}{pill('nostore', 'No store')}{pill('nopic', 'No PIC')}{pill('nobrand', 'No brand')}</div>
        <span className="text-[11px] text-zinc-500" title="Click a name, brand or PIC to edit it. It saves when you leave the box.">{shown.length} of {rows.length}</span>
        {canEdit && <div className="ml-auto">{!search && <AddClient />}</div>}
      </div>

      <div className="max-h-[calc(100vh-238px)] min-h-[360px] overflow-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full min-w-[900px] table-fixed text-left">
          <thead className="sticky top-0 z-10 border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] text-zinc-400">
            <tr><Th k="name" w="30%">Company Name</Th><Th k="brand" w="22%">Brand Name</Th><Th k="store" w="27%">Store Name</Th><Th k="pic" w="21%">PIC Name</Th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {shown.length === 0 && (
              <tr><td colSpan={4} className="p-12 text-center text-sm text-zinc-500">{rows.length === 0 ? 'No client yet.' : 'No client matches.'}</td></tr>
            )}
            {shown.map((r) => {
              const line: StoreLine = { key: r.clientId, group: [r.row], stores: r.row.stores || [] };
              return (
                <tr key={r.clientId} className="group align-top transition-colors hover:bg-[#d4af37]/[0.04]">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-black" style={{ background: colorOf(r.name) }} aria-hidden>{initials(r.name)}</span>
                      <div className="min-w-0 flex-1"><EditCell clientId={r.clientId} kind="name" value={r.name} canEdit={canEdit} placeholder="Company name" /></div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><EditCell clientId={r.clientId} kind="brand" value={r.brand} canEdit={canEdit} placeholder="Add brand" /></td>
                  <td className="px-3 py-3"><StoreCell line={line} canEdit={canEdit} storeOptions={storeOptions} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
                      <div className="min-w-0 flex-1"><EditCell clientId={r.clientId} kind="pic" value={r.pic} canEdit={canEdit} placeholder="Add PIC" /></div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
