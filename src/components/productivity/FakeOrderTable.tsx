'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, ImageIcon, X } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';
import { addFakeOrder, deleteFakeOrder, type FakeOrderRow } from '@/app/actions/fake-orders';

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
type SortKey = 'client' | 'orderNo' | 'buyer' | 'total';

/** Fake Order: Client | No Fake Order | Buyer name | Total | Proof. */
export function FakeOrderTable({ rows, clients, migrationMissing }: { rows: FakeOrderRow[]; clients: Array<{ id: string; name: string; hasInvoice: boolean }>; migrationMissing: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState('');
  const [search, setSearch] = useState('');
  const [proofView, setProofView] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'client', asc: true });

  const withInvoice = clients.filter((c) => c.hasInvoice);
  const others = clients.filter((c) => !c.hasInvoice);
  const clientNames = useMemo(() => Array.from(new Set(rows.map((r) => r.clientName))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => (!client || r.clientName === client) && (!q || `${r.clientName} ${r.orderNo} ${r.buyerName}`.toLowerCase().includes(q)));
    const val = (r: FakeOrderRow): string | number => (sort.key === 'client' ? r.clientName.toLowerCase() : sort.key === 'orderNo' ? r.orderNo.toLowerCase() : sort.key === 'buyer' ? r.buyerName.toLowerCase() : r.total);
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (sort.asc ? 1 : -1);
    });
  }, [rows, client, search, sort]);
  const total = filtered.reduce((s, r) => s + r.total, 0);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key !== 'total' }));
  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-4 py-3 font-bold ${right ? 'text-right' : ''}`}>
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>{children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} /></button>
    </th>
  );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await addFakeOrder(data);
      if (!res.success) { setError(res.error || 'Could not save.'); return; }
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    });
  };
  const remove = (r: FakeOrderRow) => {
    if (!window.confirm(`Delete fake order ${r.orderNo} of ${r.clientName}?`)) return;
    start(async () => {
      const res = await deleteFakeOrder(r.id);
      if (!res.success) { setError(res.error || 'Could not delete.'); return; }
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {migrationMissing && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">Run <b>supabase/migrations/20261016_fake_orders.sql</b> in Supabase once. Until then fake orders cannot be stored.</div>}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <select value={client} onChange={(e) => setClient(e.target.value)} className={`${field} w-[220px]`}>
          <option value="">All clients</option>
          {clientNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, order no or buyer" className={`${field} w-full min-w-[200px] sm:w-[300px]`} />
        <button onClick={() => { setOpen((v) => !v); setError(''); }} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/20">
          <Plus className="h-4 w-4" /> Add fake order
        </button>
      </div>

      {open && (
        <form ref={formRef} onSubmit={submit} className="grid gap-3 rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 lg:col-span-2">Client
            <select name="clientId" required className={`${field} mt-1 block w-full`}>
              <option value="">Choose the client</option>
              {withInvoice.length > 0 && <optgroup label="Has a Fake Order invoice">{withInvoice.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
              {others.length > 0 && <optgroup label="Other clients">{others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">No Fake Order<input name="orderNo" required className={`${field} mt-1 block w-full`} /></label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Buyer name<input name="buyerName" className={`${field} mt-1 block w-full`} /></label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total (Rp)<input name="total" inputMode="numeric" required className={`${field} mt-1 block w-full text-right font-mono`} /></label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Proof (image)<input name="proof" type="file" accept="image/*" className={`${field} mt-1 block w-full text-xs`} /></label>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-6">
            <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </form>
      )}
      {!open && error && <div className="text-xs text-red-400">{error}</div>}

      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
              <tr><Th k="client">Client</Th><Th k="orderNo">No Fake Order</Th><Th k="buyer">Buyer name</Th><Th k="total" right>Total</Th><th className="px-4 py-3 font-bold uppercase tracking-wider">Proof</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-zinc-500">{rows.length === 0 ? 'No fake order yet. Press "Add fake order".' : 'No fake order matches these filters.'}</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-900/30">
                  <td className="px-4 py-3 font-semibold text-zinc-100">{r.clientName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[#f5d77f]">{r.orderNo}</td>
                  <td className="px-4 py-3 text-zinc-300">{r.buyerName || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-100">{rp(r.total)}</td>
                  <td className="px-4 py-3">
                    {r.proofUrl ? (
                      <button onClick={() => setProofView(r.proofUrl)} className="inline-flex items-center gap-2" title="Open the proof">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.proofUrl} alt="proof" className="h-9 w-9 rounded border border-zinc-700 object-cover" />
                      </button>
                    ) : <span className="inline-flex items-center gap-1 text-zinc-700"><ImageIcon className="h-3.5 w-3.5" /> none</span>}
                  </td>
                  <td className="px-4 py-3 text-right"><button onClick={() => remove(r)} disabled={pending} className="rounded-lg border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot><tr className="border-t border-zinc-700/80 bg-zinc-900/30"><td className="px-4 py-3 font-bold uppercase tracking-wider text-zinc-400" colSpan={3}>{filtered.length} fake order(s)</td><td className="px-4 py-3 text-right font-mono font-bold text-[#f5d77f]">{rp(total)}</td><td colSpan={2} /></tr></tfoot>
            )}
          </table>
        </div>
      </div>

      {proofView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setProofView('')}>
          <button className="absolute right-4 top-4 text-zinc-300 hover:text-white" onClick={() => setProofView('')}><X className="h-6 w-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proofView} alt="proof" className="max-h-[90vh] max-w-[90vw] rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
