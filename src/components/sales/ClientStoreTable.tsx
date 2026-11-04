'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientRow } from '@/lib/sales/client-table';
import { addClientStore, removeClientStore } from '@/app/actions/sales-flow';
import { SortArrows } from '@/components/ui/SortArrows';
import { SalesCell, StatusCell, StartCell, HandlerSelect, field, type Person } from '@/components/sales/ClientProjectsTable';

const COMPANIES = ['ProOne', 'Reline', 'Alpha', 'Lighting Solution'];

/** The rows of the same client: its projects (invoices) as groups of product lines. */
function groupsOf(rows: ClientRow[]): ClientRow[][] {
  const all: ClientRow[][] = [];
  for (const r of rows) (r.groupIndex === 0 ? all.push([r]) : all[all.length - 1]?.push(r));
  return all;
}

/**
 * Optimizing > Clients: ONE line for each client, with its latest project (when the package was renewed, the earlier project is left out:
 * the older invoices stay in Accounting and Sales). The stores of the client are in the Store cell: one store is written out, several are a dropdown.
 */
export interface StoreLine {
  key: string;
  group: ClientRow[]; // the product lines of the client's latest project
  stores: Array<{ id: string; company: string; store: string }>;
}

export function storeLines(rows: ClientRow[]): StoreLine[] {
  const latest = new Map<string, ClientRow[]>();
  const score = (g: ClientRow[]) => `${g[0].invoiceId ? '1' : '0'}|${g[0].start || ''}|${g[0].paidAt || ''}|${g[0].invoiceNumber || ''}`;
  for (const g of groupsOf(rows)) {
    const cur = latest.get(g[0].clientId);
    if (!cur || score(g) > score(cur)) latest.set(g[0].clientId, g);
  }
  return Array.from(latest.values()).map((g) => ({ key: g[0].clientId, group: g, stores: g[0].stores || [] }));
}

/** "+ Create store" / "+ New store": the form opens in place, under the store name. */
function AddStore({ line, storeOptions }: { line: StoreLine; storeOptions?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('ProOne');
  const [store, setStore] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const clientId = line.group[0].clientId;
  const listId = `store-options-${company.replace(/\s+/g, '-')}`;
  const save = () => {
    setError('');
    start(async () => {
      const res = await addClientStore(clientId, company, store);
      if (!res.success) { setError(res.error || 'Could not save.'); return; }
      setStore(''); setOpen(false); router.refresh();
    });
  };
  return (
    <div className="mt-1.5">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-dashed border-zinc-600 px-2 py-0.5 text-[11px] font-bold text-zinc-300 hover:border-[#d4af37] hover:text-[#f5d77f]">{line.stores.length ? '+ New store' : '+ Create store'}</button>
      ) : (
        <div className="space-y-1.5 rounded-lg border border-zinc-700 bg-zinc-950/60 p-2">
          <select value={company} onChange={(e) => setCompany(e.target.value)} className={`${field} w-full`}>{COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input value={store} onChange={(e) => setStore(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} placeholder="Store name" list={listId} autoFocus className={`${field} w-full`} />
          <datalist id={listId}>{(storeOptions || []).filter((o) => o.toLowerCase().startsWith(`${company.toLowerCase()} - `)).map((o) => <option key={o} value={o.slice(company.length + 3)} />)}</datalist>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setError(''); }} className="px-2 py-1 text-[11px] font-bold text-zinc-400 hover:text-white">Cancel</button>
            <button type="button" disabled={pending || !store.trim()} onClick={save} className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1 text-[11px] font-bold text-[#f5d77f] disabled:opacity-40">{pending ? 'Saving...' : 'Save store'}</button>
          </div>
        </div>
      )}
      {error && <div className="mt-1 max-w-[220px] text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

/** The stores of the client: none = a dash, one = its name, several = a dropdown. The "+ Create store" / "+ New store" button is under it. */
function StoreCell({ line, canEdit, storeOptions }: { line: StoreLine; canEdit: boolean; storeOptions?: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [pick, setPick] = useState('');
  const stores = line.stores;
  const current = stores.find((x) => x.id === pick) || stores[0] || null;
  const remove = () => {
    if (!current) return;
    if (!window.confirm(`Take ${current.company} - ${current.store} away from ${line.group[0].clientName}?`)) return;
    setError('');
    start(async () => {
      const res = await removeClientStore(current.id);
      if (!res.success) setError(res.error || 'Could not remove.');
      else { setPick(''); router.refresh(); }
    });
  };
  const removable = canEdit && current && !current.id.startsWith('legacy-');
  return (
    <div>
      {!current && <span className="text-zinc-600">-</span>}
      {current && stores.length === 1 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{current.company}</div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#f5d77f]">{current.store}</span>
            {removable && <button type="button" disabled={pending} aria-label={`Remove ${current.store}`} title="Take this store away from the client" onClick={remove} className="text-zinc-500 hover:text-red-400">×</button>}
          </div>
        </div>
      )}
      {current && stores.length > 1 && (
        <div className="flex items-center gap-1.5">
          <select value={current.id} onChange={(e) => setPick(e.target.value)} className={`${field} min-w-[150px] max-w-[220px] font-semibold text-[#f5d77f]`} aria-label="Stores of this client">
            {stores.map((x) => <option key={x.id} value={x.id}>{x.store} · {x.company}</option>)}
          </select>
          <span className="text-[10px] text-zinc-500" title="Stores of this client">{stores.length}</span>
          {removable && <button type="button" disabled={pending} aria-label={`Remove ${current.store}`} title="Take the shown store away from the client" onClick={remove} className="text-zinc-500 hover:text-red-400">×</button>}
        </div>
      )}
      {error && <div className="text-[10px] text-red-400">{error}</div>}
      {canEdit && <AddStore line={line} storeOptions={storeOptions} />}
    </div>
  );
}

export function ClientStoreTable({ rows, canEditStart, canEditNames, canEditStatus, canEditSales, advertisers, admins, storeOptions }: {
  rows: ClientRow[]; canEditStart: boolean; canEditNames: boolean; canEditStatus: boolean; canEditSales: boolean;
  advertisers?: Person[]; admins?: Person[]; storeOptions?: string[];
}) {
  const assign = Boolean(advertisers && admins);
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);
  const nameOf = (list: Person[] | undefined, id: string | null) => list?.find((p) => p.id === id)?.name || '';

  const lines = useMemo(() => storeLines(rows), [rows]);
  const q = search.trim().toLowerCase();
  const shown = lines.filter((l) => {
    const r = l.group[0];
    if (onlyOpen && r.advertiserId && r.adminId) return false;
    if (!q) return true;
    return [r.clientName, ...l.stores.map((st) => `${st.company} ${st.store}`), ...l.group.map((x) => x.product), r.invoiceNumber || ''].some((t) => t.toLowerCase().includes(q));
  });
  const val = (l: StoreLine, k: string) => {
    const r = l.group[0];
    switch (k) {
      case 'client': return r.clientName.toLowerCase();
      case 'store': return l.stores.map((st) => st.store).join(' ').toLowerCase();
      case 'sales': return (r.salesman || '').toLowerCase();
      case 'product': return r.product.toLowerCase();
      case 'start': return r.start || '';
      case 'status': return r.lifecycle;
      case 'advertiser': return nameOf(advertisers, r.advertiserId).toLowerCase();
      case 'admin': return nameOf(admins, r.adminId).toLowerCase();
      default: return '';
    }
  };
  const sorted = sort ? [...shown].sort((a, b) => val(a, sort.key).localeCompare(val(b, sort.key)) * (sort.asc ? 1 : -1)) : shown;
  const Th = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <th className="px-4 py-3 font-bold">
      <button onClick={() => setSort((p) => (p?.key === k ? { key: k, asc: !p.asc } : { key: k, asc: true }))} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort?.key === k ? 'text-[#f5d77f]' : ''}`}>
        {children}<SortArrows dir={sort?.key === k ? (sort.asc ? 'asc' : 'desc') : null} />
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, store, product or invoice" className={`${field} w-full max-w-sm py-1.5`} />
        {assign && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[#d4af37]" /> Only clients missing an advertiser or admin
          </label>
        )}
        <span className="text-[11px] text-zinc-500">{sorted.length} client{sorted.length === 1 ? '' : 's'} · the latest project of each</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#d4af37]/10 bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              <Th k="client">Client</Th>
              <Th k="store">Store</Th>
              {canEditSales && <Th k="sales">Sales</Th>}
              <Th k="product">Latest project</Th>
              <Th k="start">Start</Th>
              <Th k="status">Status</Th>
              {assign && <Th k="advertiser">Advertiser</Th>}
              {assign && <Th k="admin">Admin</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {sorted.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No client matches.</td></tr>}
            {sorted.map((l) => {
              const r = l.group[0];
              return (
                <tr key={l.key} className="align-top hover:bg-zinc-900/30">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-zinc-100">{r.clientName}</div>
                    {r.invoiceNumber && <div className="font-mono text-[10px] text-zinc-500">{r.invoiceNumber}</div>}
                  </td>
                  <td className="px-4 py-3.5"><StoreCell line={l} canEdit={canEditNames} storeOptions={storeOptions} /></td>
                  {canEditSales && <td className="px-4 py-3.5"><SalesCell row={r} /></td>}
                  <td className="px-4 py-3.5 text-zinc-200">
                    {l.group.map((x, i) => <div key={i}>{x.product}{x.quantity > 1 && <span className="ml-1 text-xs text-zinc-500">x{x.quantity}</span>}</div>)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5"><StartCell row={r} canEdit={canEditStart} /></td>
                  <td className="px-4 py-3.5"><StatusCell row={r} canEdit={canEditStatus} /></td>
                  {assign && <td className="px-4 py-3.5"><HandlerSelect clientId={r.clientId} job="advertising" current={r.advertiserId} people={advertisers!} /></td>}
                  {assign && <td className="px-4 py-3.5"><HandlerSelect clientId={r.clientId} job="admin" current={r.adminId} people={admins!} /></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
