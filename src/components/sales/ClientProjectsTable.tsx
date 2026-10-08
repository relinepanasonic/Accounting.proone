'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setClientHandler, setProjectStart, updateClientNames } from '@/app/actions/sales-flow';
import type { ClientRow } from '@/lib/sales/client-table';

const field = 'rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none [color-scheme:dark]';
const dmy = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '');
const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) : '');

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  partial_paid: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  invoiced: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  sent: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  overdue: 'bg-red-500/10 text-red-300 border-red-500/30',
  draft: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
};

interface Person { id: string; name: string }

/** Cells that belong to a whole invoice span all of its product rows. */
function NameCells({ row, canEdit }: { row: ClientRow; canEdit: boolean }) {
  const router = useRouter();
  const [brand, setBrand] = useState(row.brand);
  const [store, setStore] = useState(row.store);
  const [, start] = useTransition();
  const save = () => {
    if (brand === row.brand && store === row.store) return;
    start(async () => {
      await updateClientNames(row.clientId, brand, store);
      router.refresh();
    });
  };
  const cls = `${field} w-full min-w-[120px]`;
  return (
    <>
      <td rowSpan={row.groupSize} className="px-3 py-3 align-top">
        {canEdit ? <input value={brand} onChange={(e) => setBrand(e.target.value)} onBlur={save} placeholder="Brand name" className={cls} /> : <span className="text-zinc-200">{row.brand || '-'}</span>}
      </td>
      <td rowSpan={row.groupSize} className="px-3 py-3 align-top">
        {canEdit ? <input value={store} onChange={(e) => setStore(e.target.value)} onBlur={save} placeholder="Store name" className={cls} /> : <span className="text-zinc-200">{row.store || '-'}</span>}
      </td>
    </>
  );
}

function StartCell({ row, canEdit }: { row: ClientRow; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(row.start || '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  if (!row.isDeal) return <span className="text-[11px] text-zinc-600">after payment</span>;
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
      {!row.start && <div className="mt-1 text-[10px] text-amber-300">Pick the start date</div>}
      {error && <div className="mt-1 text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

function HandlerSelect({ clientId, job, current, people }: { clientId: string; job: 'advertising' | 'admin'; current: string | null; people: Person[] }) {
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
  rows, showStatus, canEditStart, canEditNames, advertisers, admins,
}: {
  rows: ClientRow[];
  showStatus: boolean;
  canEditStart: boolean;
  canEditNames: boolean;
  /** Superadmin / founder only: dropdowns to assign who handles each client. */
  advertisers?: Person[];
  admins?: Person[];
}) {
  const assign = Boolean(advertisers && admins);
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const all: ClientRow[][] = [];
  for (const r of rows) {
    if (r.groupIndex === 0) all.push([r]);
    else all[all.length - 1]?.push(r);
  }
  const q = search.trim().toLowerCase();
  const groups = all.filter((g) => {
    if (onlyOpen && g[0].advertiserId && g[0].adminId) return false;
    if (!q) return true;
    return g.some((r) => [r.clientName, r.brand, r.store, r.product, r.invoiceNumber || ''].some((t) => t.toLowerCase().includes(q)));
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, brand, store, product or invoice" className={`${field} w-full max-w-sm py-1.5`} />
        {assign && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[#d4af37]" /> Only clients missing an advertiser or admin
          </label>
        )}
        <span className="text-[11px] text-zinc-500">{groups.length} invoice{groups.length === 1 ? '' : 's'}</span>
      </div>
    <div className="overflow-x-auto rounded-xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[11px] uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3 py-3 font-bold">Paid Date</th>
            <th className="px-3 py-3 font-bold">Start Project</th>
            <th className="px-3 py-3 font-bold">End Project</th>
            <th className="px-3 py-3 font-bold">Client</th>
            <th className="px-3 py-3 font-bold">Brand Name</th>
            <th className="px-3 py-3 font-bold">Store Name</th>
            <th className="px-3 py-3 font-bold">Product</th>
            {showStatus && <th className="px-3 py-3 font-bold">Status</th>}
            {assign && <th className="px-3 py-3 font-bold">Advertiser</th>}
            {assign && <th className="px-3 py-3 font-bold">Admin</th>}
          </tr>
        </thead>
        {groups.length === 0 && (
          <tbody><tr><td colSpan={12} className="p-8 text-center text-zinc-500">No invoices match.</td></tr></tbody>
        )}
        {groups.map((g) => (
          <tbody key={g[0].invoiceId} className="divide-y divide-zinc-800/40 border-t border-zinc-800/70">
            {g.map((row, i) => (
              <tr key={row.key} className="hover:bg-zinc-900/30">
                {i === 0 && (
                  <td rowSpan={g.length} className="px-3 py-3 align-top whitespace-nowrap">
                    {row.paidAt ? <span className="text-emerald-300">{stamp(row.paidAt)}</span> : <span className="text-zinc-600">-</span>}
                    {row.accApprovedOnly && <div className="text-[10px] text-sky-300">ACC, unpaid</div>}
                  </td>
                )}
                {i === 0 && <td rowSpan={g.length} className="px-3 py-3 align-top whitespace-nowrap"><StartCell row={row} canEdit={canEditStart} /></td>}
                <td className="px-3 py-3 whitespace-nowrap text-zinc-300">
                  {row.end ? dmy(row.end) : row.endText ? <span className="text-zinc-400">{row.endText}</span> : <span className="text-zinc-600">{row.start ? 'No length' : '-'}</span>}
                </td>
                {i === 0 && (
                  <td rowSpan={g.length} className="px-3 py-3 align-top font-bold text-zinc-100">
                    {row.clientName}
                    {row.invoiceNumber && <div className="font-mono text-[10px] font-normal text-zinc-500">{row.invoiceNumber}</div>}
                  </td>
                )}
                {i === 0 && <NameCells row={row} canEdit={canEditNames} />}
                <td className="px-3 py-3 text-zinc-200">
                  {row.product}
                  {row.quantity > 1 && <span className="ml-1 text-xs text-zinc-500">x{row.quantity}</span>}
                </td>
                {showStatus && i === 0 && (
                  <td rowSpan={g.length} className="px-3 py-3 align-top">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[String(row.status).toLowerCase()] || STATUS_STYLE.draft}`}>
                      {String(row.status || '-').replace('_', ' ')}
                    </span>
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
