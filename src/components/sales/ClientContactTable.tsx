'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Check, Plus, UserRound } from 'lucide-react';
import type { ClientRow } from '@/lib/sales/client-table';
import { updateClientContact, createClientContact } from '@/app/actions/sales-flow';
import { SortArrows } from '@/components/ui/SortArrows';
import { StoreCell, type StoreLine } from '@/components/sales/ClientStoreTable';
import { WaGroupSelect } from '@/components/wa/WaGroupSelect';

export interface ContactRow { clientId: string; name: string; brand: string; pic: string; address: string; row: ClientRow; waGroupId?: string | null }

const AVATAR = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#f87171', '#2dd4bf'];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const colorOf = (name: string) => AVATAR[Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR.length];

const quiet = 'w-full truncate rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 hover:border-zinc-700 focus:border-[#d4af37]/60 focus:bg-zinc-900 focus:outline-none';

/** A box that looks like plain text until you hover it. It saves when you leave it (Tab, Enter or a click away) and flashes a check. */
function EditCell({ clientId, kind, value, canEdit, placeholder, ids }: { clientId: string; kind: 'name' | 'brand' | 'pic' | 'address'; value: string; canEdit: boolean; placeholder: string; /** The company name of a group is changed on all its brands. */ ids?: string[] }) {
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
      const all = await Promise.all((ids && ids.length ? ids : [clientId]).map((id) => updateClientContact(id, { [kind]: next })));
      const res = all.find((r) => !r.success) || all[0];
      if (!res.success) { setError(res.error); setText(value); return; }
      setDone(true);
      router.refresh();
    });
  };
  if (kind === 'address') {
    return (
      <div className="relative">
        <textarea
          value={text}
          rows={2}
          placeholder={placeholder}
          title={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Escape') { setText(value); (e.target as HTMLTextAreaElement).blur(); } }}
          className={`${quiet} resize-none whitespace-normal pr-6 text-xs leading-snug ${pending ? 'opacity-60' : ''}`}
        />
        {done && <Check className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-emerald-400" />}
        {error && <div className="mt-0.5 px-2 text-[10px] text-red-400">{error}</div>}
      </div>
    );
  }
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

/** One more brand under a company: a new client with the same company name (its own brand, store and PIC). */
function AddBrand({ company }: { company: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [pic, setPic] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const save = () => {
    setError('');
    start(async () => {
      const res = await createClientContact({ name: company, brand, pic, sameCompany: true });
      if (!res.success) { setError(res.error); return; }
      setBrand(''); setPic(''); setOpen(false);
      router.refresh();
    });
  };
  const box = 'rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-dashed border-zinc-700 px-2 py-0.5 text-[11px] font-bold text-zinc-400 hover:border-[#d4af37] hover:text-[#f5d77f]">+ brand</button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" autoFocus className={`${box} w-36`} />
      <input value={pic} onChange={(e) => setPic(e.target.value)} placeholder="PIC (optional)" className={`${box} w-32`} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      <button type="button" disabled={pending || !brand.trim()} onClick={save} className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-bold text-[#f5d77f] disabled:opacity-40">{pending ? '...' : 'Add'}</button>
      <button type="button" onClick={() => { setOpen(false); setError(''); }} className="text-[11px] text-zinc-500 hover:text-white">Cancel</button>
      {error && <span className="w-full text-[10px] text-red-400">{error}</span>}
    </span>
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
export function ClientContactTable({ rows, canEdit, storeOptions, waGroups }: { rows: ContactRow[]; canEdit: boolean; storeOptions?: string[]; /** WhatsApp groups to choose from; leave out to hide the column. */ waGroups?: { id: string; label: string; isGroup?: boolean }[] }) {
  const showWa = !!waGroups;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<{ key: 'name' | 'brand' | 'store' | 'pic' | 'address'; asc: boolean }>({ key: 'name', asc: true });
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
      return !q || [r.name, r.brand, r.pic, r.address, storeText(r)].some((t) => t.toLowerCase().includes(q));
    });
    const val = (r: ContactRow) => (sort.key === 'name' ? r.name : sort.key === 'brand' ? r.brand : sort.key === 'pic' ? r.pic : sort.key === 'address' ? r.address : (r.row.stores || []).map((s) => s.store).join(' ')).toLowerCase();
    return list.sort((a, b) => val(a).localeCompare(val(b), 'id', { numeric: true }) * (sort.asc ? 1 : -1));
  }, [rows, q, sort, filter]);

  const groups = useMemo(() => {
    const byCompany = new Map<string, ContactRow[]>();
    for (const r of shown) {
      const k = r.name.trim().toLowerCase();
      byCompany.set(k, [...(byCompany.get(k) || []), r]);
    }
    return Array.from(byCompany.values()).map((g) => g.slice().sort((a, b) => a.brand.localeCompare(b.brand, 'id', { sensitivity: 'base' })));
  }, [shown]);

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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, brand, store, PIC or address" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/50 focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">{pill('all', 'All')}{pill('nostore', 'No store')}{pill('nopic', 'No PIC')}{pill('nobrand', 'No brand')}</div>
        <span className="text-[11px] text-zinc-500" title="Click a name, brand or PIC to edit it. It saves when you leave the box.">{shown.length} of {rows.length}</span>
        {canEdit && <div className="ml-auto">{!search && <AddClient />}</div>}
      </div>

      <div className="max-h-[calc(100vh-238px)] min-h-[360px] overflow-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full table-fixed text-left">
          <thead className="sticky top-0 z-10 border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] text-zinc-400">
            <tr><Th k="name" w={showWa ? '19%' : '22%'}>Company Name</Th><Th k="brand" w={showWa ? '13%' : '15%'}>Brand Name</Th><Th k="store" w={showWa ? '19%' : '21%'}>Store Name</Th><Th k="pic" w={showWa ? '13%' : '15%'}>PIC Name</Th><Th k="address" w={showWa ? '19%' : '27%'}>Address</Th>{showWa && <th className="px-3 py-3 font-bold uppercase tracking-wider" style={{ width: '17%' }}>WhatsApp Group</th>}</tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {groups.length === 0 && (
              <tr><td colSpan={showWa ? 6 : 5} className="p-12 text-center text-sm text-zinc-500">{rows.length === 0 ? 'No client yet.' : 'No client matches.'}</td></tr>
            )}
            {groups.map((g) => {
              const memberRow = (r: ContactRow, tree: boolean) => {
                const line: StoreLine = { key: r.clientId, group: [r.row], stores: r.row.stores || [] };
                return (
                  <tr key={r.clientId} className="group align-top transition-colors hover:bg-[#d4af37]/[0.04]">
                    <td className="px-3 py-3">
                      {tree ? (
                        <span className="ml-6 inline-block h-5 w-4 rounded-bl-md border-b border-l border-zinc-700" aria-hidden />
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-black" style={{ background: colorOf(r.name) }} aria-hidden>{initials(r.name)}</span>
                          <div className="min-w-0 flex-1">
                            <EditCell clientId={r.clientId} kind="name" value={r.name} canEdit={canEdit} placeholder="Company name" />
                            {canEdit && <div className="px-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><AddBrand company={r.name} /></div>}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3"><EditCell clientId={r.clientId} kind="brand" value={r.brand} canEdit={canEdit} placeholder="Add brand" /></td>
                    <td className="px-3 py-3"><StoreCell line={line} canEdit={canEdit} storeOptions={storeOptions} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
                        <div className="min-w-0 flex-1"><EditCell clientId={r.clientId} kind="pic" value={r.pic} canEdit={canEdit} placeholder="Add PIC" /></div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><EditCell clientId={r.clientId} kind="address" value={r.address} canEdit={canEdit} placeholder="Add address" /></td>
                    {showWa && <td className="px-3 py-3">{tree ? null : <WaGroupSelect clientIds={[r.clientId]} value={r.waGroupId || null} groups={waGroups!} />}</td>}
                  </tr>
                );
              };
              if (g.length === 1) return memberRow(g[0], false);
              // one company with several brands: the company once, then a line per brand with its own store
              const head = g[0];
              return (
                <React.Fragment key={`company:${head.name.trim().toLowerCase()}`}>
                  <tr className="bg-zinc-900/50">
                    <td colSpan={showWa ? 6 : 5} className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-black" style={{ background: colorOf(head.name) }} aria-hidden>{initials(head.name)}</span>
                        <div className="min-w-[220px] max-w-[360px] flex-1"><EditCell clientId={head.clientId} ids={g.map((x) => x.clientId)} kind="name" value={head.name} canEdit={canEdit} placeholder="Company name" /></div>
                        <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#f5d77f]">{g.length} brands</span>
                        {canEdit && <AddBrand company={head.name} />}
                        {showWa && canEdit && (
                          <span className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500">
                            WhatsApp group for all brands
                            <span className="w-56"><WaGroupSelect clientIds={g.map((x) => x.clientId)} value={g.find((x) => x.waGroupId)?.waGroupId || null} groups={waGroups!} /></span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {g.map((r) => memberRow(r, true))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
