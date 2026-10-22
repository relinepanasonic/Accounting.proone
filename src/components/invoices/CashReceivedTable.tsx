'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';

export interface CashRow {
  id: string;
  date: string; // YYYY-MM-DD
  source: 'invoice' | 'direct' | 'legacy';
  client: string;
  invoiceNumber: string;
  description: string;
  category: string;
  amount: number;
  /** Matched with a bank line in Bank Reconcile. */
  matched: boolean;
}

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dmy = (d: string) => (d ? `${d.slice(8, 10)} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '-');
const PAGE = 100;
type SortKey = 'date' | 'client' | 'invoice' | 'category' | 'amount';

const SOURCE_LABEL: Record<CashRow['source'], string> = { invoice: 'Invoice payment', direct: 'Direct income', legacy: 'Invoice (bank match)' };

/**
 * Cash Received: all the money that came in (invoice payments and direct income). Direct Income: only the part without an invoice.
 * Filters, and the Total and the number of transactions of what is on screen.
 */
export function CashReceivedTable({ rows, mode }: { rows: CashRow[]; mode: 'all' | 'direct' }) {
  const base = useMemo(() => (mode === 'direct' ? rows.filter((r) => r.source === 'direct') : rows), [rows, mode]);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [source, setSource] = useState<'' | CashRow['source']>('');
  const [bank, setBank] = useState<'' | 'matched' | 'open'>('');
  const [category, setCategory] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'date', asc: false });

  const years = useMemo(() => Array.from(new Set(base.map((r) => r.date.slice(0, 4)).filter(Boolean))).sort().reverse(), [base]);
  const categories = useMemo(() => Array.from(new Set(base.map((r) => r.category).filter(Boolean))).sort(), [base]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/[^\d]/g, '');
    const list = base.filter((r) => {
      if (year && !r.date.startsWith(year)) return false;
      if (month && r.date.slice(5, 7) !== month) return false;
      if (source && r.source !== source) return false;
      if (bank === 'matched' && !r.matched) return false;
      if (bank === 'open' && r.matched) return false;
      if (category && r.category !== category) return false;
      if (!q) return true;
      return `${r.client} ${r.invoiceNumber} ${r.description} ${r.category}`.toLowerCase().includes(q) || (digits.length >= 3 && String(Math.round(r.amount)).includes(digits));
    });
    const val = (r: CashRow): string | number => (sort.key === 'date' ? r.date : sort.key === 'client' ? r.client.toLowerCase() : sort.key === 'invoice' ? r.invoiceNumber : sort.key === 'category' ? r.category.toLowerCase() : r.amount);
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (sort.asc ? 1 : -1);
    });
  }, [base, search, year, month, source, bank, category, sort]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);
  const matchedTotal = filtered.filter((r) => r.matched).reduce((s, r) => s + r.amount, 0);
  const active = Boolean(search || year || month || source || bank || category);
  const reset = () => { setSearch(''); setYear(''); setMonth(''); setSource(''); setBank(''); setCategory(''); setShown(PAGE); };
  const re = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setShown(PAGE); };
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === 'client' || key === 'invoice' || key === 'category' }));
  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-4 py-3 font-bold ${right ? 'text-right' : ''}`}>
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>{children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} /></button>
    </th>
  );

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500">
        {mode === 'all'
          ? 'Cash Received: all the money that came in, invoice payments and direct income together. The bank is matched with these records.'
          : 'Direct Income: money that came in without an invoice.'}
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <select value={year} onChange={(e) => re(setYear)(e.target.value)} className={`${field} w-[130px]`}>
          <option value="">Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => re(setMonth)(e.target.value)} className={`${field} w-[130px]`}>
          <option value="">Month</option>
          {MON.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        {mode === 'all' && (
          <select value={source} onChange={(e) => re(setSource)(e.target.value as any)} className={`${field} w-[190px]`}>
            <option value="">All sources</option>
            <option value="invoice">Invoice payment</option>
            <option value="direct">Direct income</option>
            <option value="legacy">Invoice (bank match)</option>
          </select>
        )}
        <select value={category} onChange={(e) => re(setCategory)(e.target.value)} className={`${field} w-[180px]`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={bank} onChange={(e) => re(setBank)(e.target.value as any)} className={`${field} w-[170px]`}>
          <option value="">Bank: all</option>
          <option value="matched">Matched with bank</option>
          <option value="open">Not matched yet</option>
        </select>
        {active && <button onClick={reset} className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs font-bold text-zinc-300 hover:border-zinc-500">Reset</button>}
        <div className="relative ml-auto min-w-[220px] flex-1 lg:max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => re(setSearch)(e.target.value)} placeholder="Client, invoice, description or amount" className={`${field} w-full pl-8`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Total</div><div className="mt-1 font-serif text-xl font-bold text-emerald-400">{rp(total)}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Transactions</div><div className="mt-1 font-serif text-xl font-bold text-white">{filtered.length.toLocaleString('id-ID')}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Matched with bank</div><div className="mt-1 font-serif text-xl font-bold text-white">{rp(matchedTotal)}</div><div className="mt-0.5 text-[10px] text-zinc-500">{filtered.filter((r) => r.matched).length} of {filtered.length}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Not matched yet</div><div className="mt-1 font-serif text-xl font-bold text-white">{rp(total - matchedTotal)}</div><div className="mt-0.5 text-[10px] text-zinc-500">{filtered.filter((r) => !r.matched).length} of {filtered.length}</div></div>
      </div>

      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
              <tr>
                <Th k="date">Date</Th>
                <Th k="client">Client / Source</Th>
                <Th k="invoice">Invoice</Th>
                <Th k="category">Category</Th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Note</th>
                <Th k="amount" right>Amount</Th>
                <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Bank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-zinc-500">{base.length === 0 ? 'Nothing here yet.' : 'No transaction matches these filters.'}</td></tr>}
              {filtered.slice(0, shown).map((r) => (
                <tr key={`${r.source}-${r.id}`} className="hover:bg-zinc-900/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-300">{dmy(r.date)}</td>
                  <td className="px-4 py-3"><div className="font-semibold text-zinc-100">{r.client}</div><div className="text-[10px] text-zinc-600">{SOURCE_LABEL[r.source]}</div></td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-400">{r.invoiceNumber || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{r.category || '-'}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-zinc-500" title={r.description}>{r.description || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-emerald-400">{rp(r.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.matched ? (
                      r.source === 'legacy'
                        ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" title="Matched with the bank" />
                        : <Link href={`/bank-book?tx=${r.id}`} title="Matched with the bank. Click to see the line in Buku Bank" className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-emerald-500/20"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" /></Link>
                    ) : <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-600" title="Not matched with the bank yet" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > shown && (
          <div className="flex justify-center border-t border-zinc-800/60 p-4">
            <button onClick={() => setShown((n) => n + PAGE)} className="rounded-lg border border-[#d4af37]/40 px-6 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/10">Show more ({filtered.length - shown} left)</button>
          </div>
        )}
      </div>
    </div>
  );
}
