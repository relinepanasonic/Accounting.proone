'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';
import { recordInvoicePayment } from '@/app/actions/invoices';

export interface UnpaidInvoice { id: string; number: string; client: string; date: string; due: string; total: number; paid: number; balance: number; status: string }

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dmy = (d: string) => (d ? `${d.slice(8, 10)} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '-');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const daysLate = (due: string) => (due ? Math.floor((new Date(`${today()}T12:00:00Z`).getTime() - new Date(`${due}T12:00:00Z`).getTime()) / 86400000) : 0);
type SortKey = 'client' | 'number' | 'date' | 'due' | 'balance';

/** Unpaid invoices with the buttons Paid and Partial. The payment becomes a cash record (Cash Received) that the bank is matched with. */
export function UnpaidInvoiceTable({ rows, banks }: { rows: UnpaidInvoice[]; banks: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [overdue, setOverdue] = useState<'' | 'overdue' | 'open'>('');
  const [bankId, setBankId] = useState(banks[0]?.id || '');
  const [payDate, setPayDate] = useState(today());
  const [partial, setPartial] = useState<Record<string, number | ''>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'date', asc: true });

  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.date.slice(0, 4)).filter(Boolean))).sort().reverse(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (year && !r.date.startsWith(year)) return false;
      if (month && r.date.slice(5, 7) !== month) return false;
      if (overdue === 'overdue' && !(r.due && daysLate(r.due) > 0)) return false;
      if (overdue === 'open' && r.due && daysLate(r.due) > 0) return false;
      return !q || `${r.client} ${r.number}`.toLowerCase().includes(q);
    });
    const val = (r: UnpaidInvoice): string | number => (sort.key === 'client' ? r.client.toLowerCase() : sort.key === 'number' ? r.number : sort.key === 'date' ? r.date : sort.key === 'due' ? r.due : r.balance);
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (sort.asc ? 1 : -1);
    });
  }, [rows, search, year, month, overdue, sort]);

  const totalBalance = filtered.reduce((s, r) => s + r.balance, 0);
  const lateBalance = filtered.filter((r) => r.due && daysLate(r.due) > 0).reduce((s, r) => s + r.balance, 0);
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key !== 'balance' }));
  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-4 py-3 font-bold ${right ? 'text-right' : ''}`}>
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>{children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} /></button>
    </th>
  );

  const pay = (r: UnpaidInvoice, amount: number) => {
    if (!(amount > 0)) { setNotice({ ok: false, text: 'Fill the amount of the payment.' }); return; }
    if (amount > r.balance + 0.5) { setNotice({ ok: false, text: `The payment is more than the balance of ${r.number} (${rp(r.balance)}).` }); return; }
    setNotice(null);
    setBusy(r.id);
    start(async () => {
      const res: any = await recordInvoicePayment(r.id, amount, payDate, 'Bank Transfer', undefined, undefined, bankId && !bankId.startsWith('temp-') ? bankId : undefined, true);
      setBusy(null);
      if (!res?.success) { setNotice({ ok: false, text: res?.error || 'Could not record the payment.' }); return; }
      setNotice({ ok: true, text: `${r.number}: ${rp(amount)} recorded as ${amount >= r.balance - 0.5 ? 'Paid' : 'Partial payment'}. It is now in Cash Received: match it in Reconcile.` });
      setPartial((p) => ({ ...p, [r.id]: '' }));
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <select value={year} onChange={(e) => setYear(e.target.value)} className={`${field} w-[130px]`}><option value="">Year</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${field} w-[130px]`}><option value="">Month</option>{MON.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}</select>
        <select value={overdue} onChange={(e) => setOverdue(e.target.value as any)} className={`${field} w-[170px]`}><option value="">All unpaid</option><option value="overdue">Overdue</option><option value="open">Not due yet</option></select>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          Payment date <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={`${field} py-2 [color-scheme:dark]`} />
          {banks.length > 0 && <select value={bankId} onChange={(e) => setBankId(e.target.value)} className={`${field} py-2`} title="The bank account that received the money">{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        </div>
        <div className="relative ml-auto min-w-[220px] flex-1 lg:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client or invoice number" className={`${field} w-full pl-8`} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Unpaid total</div><div className="mt-1 font-serif text-xl font-bold text-white">{rp(totalBalance)}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Invoices</div><div className="mt-1 font-serif text-xl font-bold text-white">{filtered.length}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Overdue</div><div className="mt-1 font-serif text-xl font-bold text-red-400">{rp(lateBalance)}</div></div>
      </div>

      {notice && <div className={`rounded-lg border p-3 text-xs ${notice.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-red-500/30 bg-red-500/5 text-red-300'}`}>{notice.text}</div>}

      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
              <tr><Th k="client">Client</Th><Th k="number">Invoice</Th><Th k="date">Date</Th><Th k="due">Due</Th><th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Total</th><th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Paid</th><Th k="balance" right>Balance</Th><th className="px-4 py-3 font-bold uppercase tracking-wider">Payment</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-zinc-500">{rows.length === 0 ? 'Every invoice is paid.' : 'No invoice matches these filters.'}</td></tr>}
              {filtered.map((r) => {
                const late = r.due ? daysLate(r.due) : 0;
                return (
                  <tr key={r.id} className="hover:bg-zinc-900/30">
                    <td className="px-4 py-3 font-semibold text-zinc-100">{r.client}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-400">{r.number}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-300">{dmy(r.date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">{r.due ? <span className={late > 0 ? 'text-red-400' : 'text-zinc-400'}>{dmy(r.due)}{late > 0 ? ` · ${late}d late` : ''}</span> : <span className="text-zinc-600">-</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-400">{rp(r.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">{r.paid > 0 ? rp(r.paid) : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-[#f5d77f]">{rp(r.balance)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button disabled={pending} onClick={() => pay(r, r.balance)} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40">{busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Paid'}</button>
                        <input type="number" min={1} placeholder="Partial Rp" value={partial[r.id] ?? ''} onChange={(e) => setPartial({ ...partial, [r.id]: e.target.value === '' ? '' : Number(e.target.value) })} className="w-[110px] rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-right font-mono text-[11px] text-zinc-100 outline-none" />
                        <button disabled={pending || !partial[r.id]} onClick={() => pay(r, Number(partial[r.id] || 0))} className="rounded-lg border border-sky-500/40 px-3 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/10 disabled:opacity-40">Partial</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
