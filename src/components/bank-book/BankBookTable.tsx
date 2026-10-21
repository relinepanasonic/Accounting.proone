'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export interface BankBookLine { id: string; bankAccountId: string; date: string; counterparty: string; details: string; notes: string; amount: number; status: string; fileName: string }
export interface BankBookAccount { id: string; bankName: string; accountNumber: string; accountName: string }

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const rp = (n: number) => `Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;
const PAGE = 100;

const bankLabel = (b: BankBookAccount) => `${b.bankName}${b.accountName ? ` · ${b.accountName}` : ''}`;

/** Buku Bank: all stored statement lines, filtered by bank account, month, direction and text. */
export function BankBookTable({ lines, banks, migrationMissing }: { lines: BankBookLine[]; banks: BankBookAccount[]; migrationMissing: boolean }) {
  const [bank, setBank] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [dir, setDir] = useState<'' | 'in' | 'out'>('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);
  const years = useMemo(() => Array.from(new Set(lines.map((l) => l.date.slice(0, 4)))).sort().reverse(), [lines]);
  const countByBank = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.bankAccountId, (m.get(l.bankAccountId) || 0) + 1);
    return m;
  }, [lines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/[^\d]/g, '');
    return lines.filter((l) => {
      if (bank && l.bankAccountId !== bank) return false;
      if (year && !l.date.startsWith(year)) return false;
      if (month && l.date.slice(5, 7) !== month) return false;
      if (dir === 'in' && l.amount <= 0) return false;
      if (dir === 'out' && l.amount >= 0) return false;
      if (status && l.status !== status) return false;
      if (!q) return true;
      return `${l.counterparty} ${l.details} ${l.notes}`.toLowerCase().includes(q) || (digits.length >= 3 && String(Math.round(Math.abs(l.amount))).includes(digits));
    });
  }, [lines, bank, year, month, dir, status, search]);

  const totalIn = filtered.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
  const totalOut = filtered.reduce((s, l) => s + (l.amount < 0 ? -l.amount : 0), 0);
  const reset = () => { setBank(''); setYear(''); setMonth(''); setDir(''); setStatus(''); setSearch(''); setShown(PAGE); };
  const reflow = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setShown(PAGE); };

  return (
    <div className="space-y-5">
      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
          Run <b>supabase/migrations/20261014_bank_book.sql</b> in Supabase once. Until then uploaded statements cannot be stored here.
        </div>
      )}

      {/* Bank filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => reflow(setBank)('')} className={`rounded-full border px-4 py-1.5 text-xs font-bold ${bank === '' ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f5d77f]' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
          All banks <span className="ml-1 font-mono text-[10px] opacity-70">{lines.length}</span>
        </button>
        {banks.map((b) => (
          <button key={b.id} onClick={() => reflow(setBank)(b.id)} title={b.accountNumber} className={`rounded-full border px-4 py-1.5 text-xs font-bold ${bank === b.id ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f5d77f]' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
            {bankLabel(b)} <span className="ml-1 font-mono text-[10px] opacity-70">{countByBank.get(b.id) || 0}</span>
          </button>
        ))}
      </div>

      {/* Other filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => reflow(setSearch)(e.target.value)} placeholder="Name, details, notes or amount" className={`${field} w-full pl-8`} />
        </div>
        <select value={year} onChange={(e) => reflow(setYear)(e.target.value)} className={field}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => reflow(setMonth)(e.target.value)} className={field}>
          <option value="">All months</option>
          {Array.from({ length: 12 }).map((_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{new Date(2000, i, 1).toLocaleString('en-GB', { month: 'long' })}</option>)}
        </select>
        <select value={dir} onChange={(e) => reflow(setDir)(e.target.value as any)} className={field}>
          <option value="">In and out</option>
          <option value="in">Money in</option>
          <option value="out">Money out</option>
        </select>
        <select value={status} onChange={(e) => reflow(setStatus)(e.target.value)} className={field}>
          <option value="">Any status</option>
          <option value="unreconciled">Unreconciled</option>
          <option value="reconciled">Reconciled</option>
          <option value="ignored">Ignored</option>
        </select>
        {(bank || year || month || dir || status || search) && <button onClick={reset} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-500">Reset</button>}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Lines</div><div className="mt-1 font-serif text-xl font-bold text-white">{filtered.length}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Money in</div><div className="mt-1 font-serif text-xl font-bold text-emerald-400">{rp(totalIn)}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Money out</div><div className="mt-1 font-serif text-xl font-bold text-red-400">{rp(totalOut)}</div></div>
      </div>

      {/* Table */}
      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Bank</th>
                <th className="px-4 py-3 font-bold">Source / Destination</th>
                <th className="px-4 py-3 font-bold">Details</th>
                <th className="px-4 py-3 text-right font-bold">In</th>
                <th className="px-4 py-3 text-right font-bold">Out</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-zinc-500">{lines.length === 0 ? 'Nothing stored yet. Upload a bank statement in Bank Reconcile and it appears here.' : 'No line matches these filters.'}</td></tr>
              )}
              {filtered.slice(0, shown).map((l) => (
                <tr key={l.id} className="hover:bg-zinc-900/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-300">{l.date}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{bankById.get(l.bankAccountId)?.bankName || '-'}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-zinc-100" title={l.counterparty}>{l.counterparty || '-'}</td>
                  <td className="max-w-[300px] truncate px-4 py-3 text-zinc-500" title={`${l.details} ${l.notes}`}>{[l.details, l.notes].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-emerald-400">{l.amount > 0 ? rp(l.amount) : ''}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-red-400">{l.amount < 0 ? rp(l.amount) : ''}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${l.status === 'reconciled' ? 'border-emerald-500/30 text-emerald-400' : l.status === 'ignored' ? 'border-zinc-600 text-zinc-500' : 'border-amber-500/30 text-amber-400'}`}>{l.status}</span>
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-zinc-600" title={l.fileName}>{l.fileName || '-'}</td>
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
