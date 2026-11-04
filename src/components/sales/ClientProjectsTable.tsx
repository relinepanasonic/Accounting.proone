'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setClientHandler, setClientStatus, setProjectStart, setInvoiceSales, setClientSales, addClientStore, removeClientStore } from '@/app/actions/sales-flow';
import { SALES_PEOPLE } from '@/lib/sales/people';
import type { ClientRow } from '@/lib/sales/client-table';
import { SortArrows } from '@/components/ui/SortArrows';

export const field = 'rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none [color-scheme:dark]';
export const dmy = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '');
const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) : '');

const LIFE_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  scheduled: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  freeze: 'bg-cyan-500/10 text-cyan-200 border-cyan-400/40',
  finished: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  churn: 'bg-red-500/10 text-red-300 border-red-500/30',
};
const LIFE_LABEL: Record<string, string> = { active: 'Active', scheduled: 'Scheduled', freeze: 'Freeze', finished: 'Finished', churn: 'Churn' };

export interface Person { id: string; name: string }

const COMPANIES = ['ProOne', 'Reline', 'Alpha', 'Lighting Solution'];

/** The Store of a client is saved as "<Company> - <Store>" (e.g. "ProOne - Toko A"): it links the client to the store of Profesor Dashboard or Reline. */
export function splitStore(value: string): { company: string; store: string } {
  // "ProOne - Toko A", or just "ProOne -" when only the company is chosen so far.
  const m = /^\s*(ProOne|Reline|Alpha|Lighting Solution)\s+-(?:\s+(.*))?\s*$/i.exec(value || '');
  if (!m) return { company: '', store: value || '' };
  const company = COMPANIES.find((c) => c.toLowerCase() === m[1].toLowerCase()) || m[1];
  return { company, store: m[2] || '' };
}

/** Cells that belong to a whole invoice span all of its product rows: Company and Store. A client can have several stores. */
function NameCells({ row, canEdit, storeOptions }: { row: ClientRow; canEdit: boolean; storeOptions?: string[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [company, setCompany] = useState('ProOne');
  const [store, setStore] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const stores = row.stores || [];
  const companies = Array.from(new Set(stores.map((x) => x.company)));
  const listId = `client-store-options-${company.replace(/\s+/g, '-')}`;
  const cls = `${field} w-full min-w-[120px]`;

  const add = () => {
    setError('');
    start(async () => {
      const res = await addClientStore(row.clientId, company, store);
      if (!res.success) { setError(res.error || 'Could not save.'); return; }
      setStore(''); setAdding(false);
      router.refresh();
    });
  };
  const remove = (id: string, label: string) => {
    if (!window.confirm(`Take ${label} away from ${row.clientName}?`)) return;
    setError('');
    start(async () => {
      const res = await removeClientStore(id);
      if (!res.success) setError(res.error || 'Could not remove.');
      else router.refresh();
    });
  };

  return (
    <>
      <td rowSpan={row.groupSize} className="px-3 py-3 align-top">
        {companies.length ? <div className="flex flex-col gap-1">{companies.map((c) => <span key={c} className="text-zinc-200">{c}</span>)}</div> : <span className="text-zinc-600">-</span>}
      </td>
      <td rowSpan={row.groupSize} className="min-w-[220px] px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          {stores.map((x) => (
            <span key={x.id} title={`${x.company} - ${x.store}`} className="inline-flex max-w-[230px] items-center gap-1 rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f5d77f]">
              <span className="truncate">{x.store}</span>
              {canEdit && !x.id.startsWith('legacy-') && <button type="button" disabled={pending} onClick={() => remove(x.id, `${x.company} - ${x.store}`)} aria-label={`Remove ${x.store}`} className="text-[#f5d77f]/60 hover:text-red-400">×</button>}
            </span>
          ))}
          {canEdit && !adding && (
            <button type="button" onClick={() => { setAdding(true); setError(''); }} className="rounded-md border border-dashed border-zinc-600 px-2 py-0.5 text-[11px] font-bold text-zinc-300 hover:border-[#d4af37] hover:text-[#f5d77f]">{stores.length ? '+ New store' : '+ Create store'}</button>
          )}
          {!canEdit && stores.length === 0 && <span className="text-zinc-600">-</span>}
        </div>
        {canEdit && adding && (
          <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-700 bg-zinc-950/60 p-2">
            <select value={company} onChange={(e) => setCompany(e.target.value)} className={cls}>{COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <input value={store} onChange={(e) => setStore(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="Store name" list={listId} autoFocus className={cls} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setAdding(false); setError(''); }} className="px-2 py-1 text-[11px] font-bold text-zinc-400 hover:text-white">Cancel</button>
              <button type="button" disabled={pending || !store.trim()} onClick={add} className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1 text-[11px] font-bold text-[#f5d77f] disabled:opacity-40">{pending ? 'Saving...' : 'Save store'}</button>
            </div>
          </div>
        )}
        {error && <div className="mt-1 max-w-[230px] text-[10px] text-red-400">{error}</div>}
      </td>
    </>
  );
}

/** Who sold this project: a dropdown for the owners and Accounting, saved at once. */
export function SalesCell({ row }: { row: ClientRow }) {
  const router = useRouter();
  const [value, setValue] = useState(row.salesman);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const list = value && !SALES_PEOPLE.includes(value) ? [...SALES_PEOPLE, value] : SALES_PEOPLE;
  return (
    <div>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setError('');
          start(async () => {
            // A client without an invoice keeps its salesman on the client itself.
            const res = row.invoiceId ? await setInvoiceSales(row.invoiceId, next || null) : await setClientSales(row.clientId, next || null);
            if (!res.success) { setValue(prev); setError(res.error || 'Could not save.'); } else router.refresh();
          });
        }}
        className={`${field} min-w-[110px]`}
      >
        <option value="">Not assigned</option>
        {list.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      {error && <div className="mt-1 max-w-[170px] text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

/** The paid date comes from the payment recorded on the invoice. Nobody types it here. */
function PaidCell({ row }: { row: ClientRow; canEdit?: boolean }) {
  return row.paidAt ? (
    <>
      <span className="text-emerald-300">{stamp(row.paidAt)}</span>
      {row.accApprovedOnly && <div className="text-[10px] text-sky-300">ACC, unpaid</div>}
    </>
  ) : (
    <span className="text-zinc-600">-</span>
  );
}

export function StatusCell({ row, canEdit }: { row: ClientRow; canEdit: boolean }) {
  // The change shows at once; the save runs behind it and is undone only if it fails. No page reload.
  const router = useRouter();
  const [life, setLife] = useState(row.lifecycle);
  const [override, setOverride] = useState(row.override);
  const [churnDate, setChurnDate] = useState(row.churnDate);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const editable = canEdit && Boolean(row.invoiceId);
  const badge = `inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${LIFE_STYLE[life]}`;

  const choose = (status: 'auto' | 'freeze' | 'churn' | 'finished') => {
    setError('');
    const before = { life, override, churnDate };
    setOpen(false);
    setOverride(status === 'auto' ? null : status);
    if (status !== 'auto') setLife(status); // Auto: the real state comes from the dates, so it is read again below
    setChurnDate(status === 'churn' ? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : null);
    start(async () => {
      const res = await setClientStatus(row.invoiceId, status);
      if (!res.success) { setError(res.error); setLife(before.life); setOverride(before.override); setChurnDate(before.churnDate); return; }
      if (status === 'auto') router.refresh();
    });
  };

  return (
    <div className="space-y-1.5">
      {editable ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className={`${badge} cursor-pointer hover:brightness-125 ${pending ? 'opacity-70' : ''}`} title="Click to change the status">
          {LIFE_LABEL[life]} <span className="text-[8px] opacity-70">{open ? '▲' : '▼'}</span>
        </button>
      ) : (
        <span className={badge}>{LIFE_LABEL[life]}</span>
      )}
      {life === 'churn' && churnDate && <div className="text-[10px] text-zinc-500">since {dmy(churnDate)}</div>}
      {editable && open && (
        <div className="flex flex-col items-start gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5">
          {([['auto', 'Auto (by dates)'], ['finished', 'Finished (client stays)'], ['freeze', 'Freeze'], ['churn', 'Churn (client left)']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => choose(k)}
              className={`w-full rounded-md px-2 py-1 text-left text-[11px] font-semibold hover:bg-zinc-800 ${(override || 'auto') === k ? 'text-[#f5d77f]' : 'text-zinc-300'}`}
            >
              {(override || 'auto') === k ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
      )}
      {error && <div className="text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

export function StartCell({ row, canEdit }: { row: ClientRow; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(row.start || '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  if (!row.invoiceId) return <span className="text-zinc-600">-</span>;
  if (!canEdit) return <span className="text-zinc-300">{dmy(row.start) || '-'}</span>;
  return (
    <div>
      <input
        type="date"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          if (!v) return;
          setError('');
          start(async () => {
            const res = await setProjectStart(row.invoiceId, v);
            if (!res.success) setError(res.error);
            router.refresh();
          });
        }}
        className={`${field} ${row.start ? '' : 'border-amber-500/50'}`}
      />
      {!row.start && <div className="mt-1 text-[10px] text-amber-300">Pick the start date{!row.isDeal ? ' (not paid yet)' : ''}</div>}
      {row.start && row.startAuto && <div className="mt-1 text-[10px] text-zinc-500">from the invoice project date</div>}
      {error && <div className="mt-1 text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

export function HandlerSelect({ clientId, job, current, people }: { clientId: string; job: 'advertising' | 'admin'; current: string | null; people: Person[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current || '');
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        setValue(v);
        start(async () => {
          await setClientHandler(clientId, job, v || null);
          router.refresh();
        });
      }}
      className={`${field} min-w-[130px]`}
    >
      <option value="">Not assigned</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function ClientProjectsTable({
  rows, showStatus, canEditStart, canEditNames, canEditPaid = false, canEditStatus = false, canEditSales = false, hidePaid = false, showSalesman = false, compact = false, advertisers, admins, storeOptions,
}: {
  rows: ClientRow[];
  showStatus: boolean;
  canEditStart: boolean;
  canEditNames: boolean;
  /** Accounting types the paid date by hand. */
  canEditPaid?: boolean;
  /** Accounting sets Freeze / Churn by hand. */
  canEditStatus?: boolean;
  /** Owners and Accounting assign who sold each project (the Sales column becomes a dropdown). */
  canEditSales?: boolean;
  /** Advertiser / Admin tabs: no Paid Date column. */
  hidePaid?: boolean;
  /** Sales tabs: which salesman got the client. */
  showSalesman?: boolean;
  /** Optimizing > Clients: no Paid Date and End Project (they stay in Accounting and Sales), tighter columns that fit one wide screen. */
  compact?: boolean;
  /** "Company - Store" of every store of Profesor Dashboard (ProOne) and Reline (Reline, Alpha, Lighting Solution): suggestions for the Store column. */
  storeOptions?: string[];
  /** Superadmin / founder only: dropdowns to assign who handles each client. */
  advertisers?: Person[];
  admins?: Person[];
}) {
  const assign = Boolean(advertisers && admins);
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);
  const nameOf = (list: Person[] | undefined, id: string | null) => list?.find((p) => p.id === id)?.name || '';
  const sortValue = (g: ClientRow[], key: string): string => {
    const r = g[0];
    switch (key) {
      case 'paid': return r.paidAt || '';
      case 'start': return r.start || '';
      case 'end': return r.end || '';
      case 'client': return r.clientName.toLowerCase();
      case 'salesman': return (r.salesman || '').toLowerCase();
      case 'company': return (r.stores || []).map((x) => x.company).join(' ').toLowerCase();
      case 'store': return (r.stores || []).map((x) => x.store).join(' ').toLowerCase();
      case 'product': return r.product.toLowerCase();
      case 'status': return r.lifecycle;
      case 'advertiser': return nameOf(advertisers, r.advertiserId).toLowerCase();
      case 'admin': return nameOf(admins, r.adminId).toLowerCase();
      default: return '';
    }
  };
  const toggleSort = (key: string) => setSort((p) => (p?.key === key ? { key, asc: !p.asc } : { key, asc: true }));
  const Th = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <th className="px-3 py-3 font-bold">
      <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort?.key === k ? 'text-[#f5d77f]' : ''}`}>
        {children}<SortArrows dir={sort?.key === k ? (sort.asc ? 'asc' : 'desc') : null} />
      </button>
    </th>
  );
  const all: ClientRow[][] = [];
  for (const r of rows) {
    if (r.groupIndex === 0) all.push([r]);
    else all[all.length - 1]?.push(r);
  }
  const q = search.trim().toLowerCase();
  const filteredGroups = all.filter((g) => {
    if (onlyOpen && g[0].advertiserId && g[0].adminId) return false;
    if (!q) return true;
    return g.some((r) => [r.clientName, ...(r.stores || []).map((x) => `${x.company} ${x.store}`), r.product, r.invoiceNumber || ''].some((t) => t.toLowerCase().includes(q)));
  });
  // A sorted list keeps the products of one invoice together (the group moves as one).
  const groups = sort ? [...filteredGroups].sort((a, b) => sortValue(a, sort.key).localeCompare(sortValue(b, sort.key)) * (sort.asc ? 1 : -1)) : filteredGroups;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, company, store, product or invoice" className={`${field} w-full max-w-sm py-1.5`} />
        {assign && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[#d4af37]" /> Only clients missing an advertiser or admin
          </label>
        )}
        <span className="text-[11px] text-zinc-500">{groups.length} row{groups.length === 1 ? '' : 's'}</span>
      </div>
    {COMPANIES.map((c) => (
      <datalist key={c} id={`client-store-options-${c.replace(/\s+/g, '-')}`}>
        {(storeOptions || []).filter((o) => splitStore(o).company === c).map((o) => <option key={o} value={splitStore(o).store} />)}
      </datalist>
    ))}
    <div className={`overflow-x-auto rounded-xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl ${compact ? '[&_td]:min-w-0 [&_td]:px-2 [&_th]:px-2' : ''}`}>
      <table className={`w-full text-left ${compact ? 'text-xs' : 'text-sm'}`}>
        <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[11px] uppercase tracking-wider text-zinc-400">
          <tr>
            {!hidePaid && !compact && <Th k="paid">Paid Date</Th>}
            <Th k="start">Start Project</Th>
            {!compact && <Th k="end">End Project</Th>}
            <Th k="client">Client</Th>
            {(showSalesman || canEditSales) && <Th k="salesman">Sales</Th>}
            <Th k="company">Company</Th>
            <Th k="store">Store</Th>
            <Th k="product">Product</Th>
            {showStatus && <Th k="status">Status</Th>}
            {assign && <Th k="advertiser">Advertiser</Th>}
            {assign && <Th k="admin">Admin</Th>}
          </tr>
        </thead>
        {groups.length === 0 && (
          <tbody><tr><td colSpan={12} className="p-8 text-center text-zinc-500">No invoices match.</td></tr></tbody>
        )}
        {groups.map((g) => (
          <tbody key={g[0].key} className="divide-y divide-zinc-800/40 border-t border-zinc-800/70">
            {g.map((row, i) => (
              <tr key={row.key} className="hover:bg-zinc-900/30">
                {i === 0 && !hidePaid && !compact && (
                  <td rowSpan={g.length} className="px-3 py-3 align-top whitespace-nowrap">
                    <PaidCell row={row} canEdit={canEditPaid} />
                  </td>
                )}
                {i === 0 && <td rowSpan={g.length} className="px-3 py-3 align-top whitespace-nowrap"><StartCell row={row} canEdit={canEditStart} /></td>}
                {!compact && <td className="px-3 py-3 whitespace-nowrap text-zinc-300">
                  {row.end ? dmy(row.end) : row.endText ? <span className="text-zinc-400">{row.endText}</span> : <span className="text-zinc-600">{row.start ? 'No length' : '-'}</span>}
                </td>}
                {i === 0 && (
                  <td rowSpan={g.length} className="px-3 py-3 align-top font-bold text-zinc-100">
                    {row.clientName}
                    {row.invoiceNumber && <div className="font-mono text-[10px] font-normal text-zinc-500">{row.invoiceNumber}</div>}
                  </td>
                )}
                {i === 0 && (showSalesman || canEditSales) && <td rowSpan={g.length} className="px-3 py-3 align-top whitespace-nowrap text-zinc-300">{canEditSales ? <SalesCell row={row} /> : row.salesman || <span className="text-zinc-600">-</span>}</td>}
                {i === 0 && <NameCells row={row} canEdit={canEditNames} storeOptions={storeOptions} />}
                <td className="min-w-[260px] px-3 py-3 text-zinc-200">
                  {row.product}
                  {row.quantity > 1 && <span className="ml-1 text-xs text-zinc-500">x{row.quantity}</span>}
                </td>
                {showStatus && i === 0 && (
                  <td rowSpan={g.length} className="px-3 py-3 align-top">
                    <StatusCell row={row} canEdit={canEditStatus} />
                  </td>
                )}
                {assign && i === 0 && <td rowSpan={g.length} className="px-3 py-3 align-top"><HandlerSelect clientId={row.clientId} job="advertising" current={row.advertiserId} people={advertisers!} /></td>}
                {assign && i === 0 && <td rowSpan={g.length} className="px-3 py-3 align-top"><HandlerSelect clientId={row.clientId} job="admin" current={row.adminId} people={admins!} /></td>}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
    </div>
  );
}
