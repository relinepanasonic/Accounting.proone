'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientRow } from '@/lib/sales/client-table';
import { updateClientContact, createClientContact } from '@/app/actions/sales-flow';
import { SortArrows } from '@/components/ui/SortArrows';
import { field } from '@/components/sales/ClientProjectsTable';
import { StoreCell, type StoreLine } from '@/components/sales/ClientStoreTable';

export interface ContactRow { clientId: string; name: string; brand: string; pic: string; row: ClientRow }

/** One box of the table: it saves when you leave it (Tab / click away), and shows what went wrong. */
function EditCell({ clientId, kind, value, canEdit, placeholder }: { clientId: string; kind: 'name' | 'brand' | 'pic'; value: string; canEdit: boolean; placeholder: string }) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  React.useEffect(() => setText(value), [value]);
  if (!canEdit) return <span className="text-zinc-200">{value || <span className="text-zinc-600">-</span>}</span>;
  const save = () => {
    const next = text.trim();
    if (next === value.trim()) return;
    if (kind === 'name' && !next) { setText(value); setError('The company name cannot be empty.'); return; }
    setError('');
    start(async () => {
      const res = await updateClientContact(clientId, { [kind]: next });
      if (!res.success) { setError(res.error); setText(value); return; }
      router.refresh();
    });
  };
  return (
    <div>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={`${field} w-full min-w-[150px] ${kind === 'name' ? 'font-bold' : ''} ${pending ? 'opacity-60' : ''}`}
      />
      {error && <div className="mt-0.5 max-w-[220px] text-[10px] text-red-400">{error}</div>}
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
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1.5 text-xs font-bold text-[#f5d77f] hover:brightness-125">+ New client</button>;
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name *" autoFocus className={`${field} w-48`} />
      <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" className={`${field} w-40`} />
      <input value={pic} onChange={(e) => setPic(e.target.value)} placeholder="PIC name" className={`${field} w-40`} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      <button type="button" disabled={pending || !name.trim()} onClick={save} className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1.5 text-xs font-bold text-[#f5d77f] disabled:opacity-40">{pending ? 'Saving...' : 'Save client'}</button>
      <button type="button" onClick={() => { setOpen(false); setError(''); }} className="px-2 py-1.5 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
      {error && <div className="w-full text-[11px] text-red-400">{error}</div>}
    </div>
  );
}

/**
 * Accounting > Client Contact: Company Name | Brand Name | Store Name | PIC Name for every client. It is the same client data as
 * Optimizing > Clients (one source), so a change made in either place is the other's too.
 */
export function ClientContactTable({ rows, canEdit, storeOptions }: { rows: ContactRow[]; canEdit: boolean; storeOptions?: string[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'brand' | 'store' | 'pic'; asc: boolean }>({ key: 'name', asc: true });
  const q = search.trim().toLowerCase();
  const shown = useMemo(() => {
    const storeText = (r: ContactRow) => (r.row.stores || []).map((s) => `${s.company} ${s.store}`).join(' ');
    const list = rows.filter((r) => !q || [r.name, r.brand, r.pic, storeText(r)].some((t) => t.toLowerCase().includes(q)));
    const val = (r: ContactRow) => (sort.key === 'name' ? r.name : sort.key === 'brand' ? r.brand : sort.key === 'pic' ? r.pic : (r.row.stores || []).map((s) => s.store).join(' ')).toLowerCase();
    return list.sort((a, b) => val(a).localeCompare(val(b), 'id', { numeric: true }) * (sort.asc ? 1 : -1));
  }, [rows, q, sort]);

  const Th = ({ k, children }: { k: typeof sort.key; children: React.ReactNode }) => (
    <th className="px-4 py-3 font-bold">
      <button onClick={() => setSort((p) => (p.key === k ? { key: k, asc: !p.asc } : { key: k, asc: true }))} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>
        {children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} />
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, brand, store or PIC" className={`${field} w-full max-w-sm py-1.5`} />
        <span className="text-[11px] text-zinc-500">{shown.length} client{shown.length === 1 ? '' : 's'}</span>
        {canEdit && <div className="ml-auto"><AddClient /></div>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#d4af37]/10 bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-400">
            <tr><Th k="name">Company Name</Th><Th k="brand">Brand Name</Th><Th k="store">Store Name</Th><Th k="pic">PIC Name</Th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {shown.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-zinc-500">No client matches.</td></tr>}
            {shown.map((r) => {
              const line: StoreLine = { key: r.clientId, group: [r.row], stores: r.row.stores || [] };
              return (
                <tr key={r.clientId} className="align-top hover:bg-zinc-900/30">
                  <td className="px-4 py-3"><EditCell clientId={r.clientId} kind="name" value={r.name} canEdit={canEdit} placeholder="Company name" /></td>
                  <td className="px-4 py-3"><EditCell clientId={r.clientId} kind="brand" value={r.brand} canEdit={canEdit} placeholder="Brand name" /></td>
                  <td className="px-4 py-3"><StoreCell line={line} canEdit={canEdit} storeOptions={storeOptions} /></td>
                  <td className="px-4 py-3"><EditCell clientId={r.clientId} kind="pic" value={r.pic} canEdit={canEdit} placeholder="PIC name" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
