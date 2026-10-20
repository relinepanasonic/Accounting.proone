'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

export interface LedgerEntryLine { id: string; account_name: string; debit_amount: number; credit_amount: number }
export interface LedgerEntry { id: string; entry_number: string; entry_date: string; description: string; source_module: string; lines: LedgerEntryLine[] }

const field = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const lab = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500';
const PAGE = 60;

/** The journal as cards, with a search and filters (month, source, account) so one entry is easy to find. */
export function LedgerEntries({ entries }: { entries: LedgerEntry[] }) {
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [source, setSource] = useState('');
  const [account, setAccount] = useState('');
  const [shown, setShown] = useState(PAGE);

  const months = useMemo(() => Array.from(new Set(entries.map((e) => String(e.entry_date).slice(0, 7)))).sort().reverse(), [entries]);
  const sources = useMemo(() => Array.from(new Set(entries.map((e) => e.source_module))).sort(), [entries]);
  const accounts = useMemo(() => Array.from(new Set(entries.flatMap((e) => e.lines.map((l) => l.account_name)))).sort(), [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/[^\d]/g, '');
    return entries.filter((e) => {
      if (month && !String(e.entry_date).startsWith(month)) return false;
      if (source && e.source_module !== source) return false;
      if (account && !e.lines.some((l) => l.account_name === account)) return false;
      if (!q) return true;
      if (e.entry_number.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q) || e.source_module.toLowerCase().includes(q)) return true;
      if (e.lines.some((l) => l.account_name.toLowerCase().includes(q))) return true;
      // An amount typed with or without dots: 4.500.000 or 4500000
      return digits.length >= 3 && e.lines.some((l) => String(Math.round(l.debit_amount || l.credit_amount)).includes(digits));
    });
  }, [entries, search, month, source, account]);

  const active = Boolean(search || month || source || account);
  const reset = () => { setSearch(''); setMonth(''); setSource(''); setAccount(''); setShown(PAGE); };
  const monthName = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={lab}>Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} placeholder="Invoice no, client, account, amount" className={`${field} pl-8`} />
          </div>
        </div>
        <div>
          <label className={lab}>Month</label>
          <select value={month} onChange={(e) => { setMonth(e.target.value); setShown(PAGE); }} className={field}>
            <option value="">All months</option>
            {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
          </select>
        </div>
        <div>
          <label className={lab}>Source</label>
          <select value={source} onChange={(e) => { setSource(e.target.value); setShown(PAGE); }} className={field}>
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={lab}>Account</label>
          <select value={account} onChange={(e) => { setAccount(e.target.value); setShown(PAGE); }} className={field}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-500 sm:col-span-2 lg:col-span-4">
          <span>{filtered.length} of {entries.length} entries</span>
          {active && <button onClick={reset} className="rounded-lg border border-zinc-700 px-3 py-1 font-bold text-zinc-300 hover:border-zinc-500">Reset filters</button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="gold-glass-panel rounded-2xl p-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]"><BookOpen className="w-6 h-6" /></div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{entries.length === 0 ? 'No Double-Entry Journal Entries Posted Yet' : 'No entry matches these filters'}</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">{entries.length === 0 ? 'Activity ledger transactions are automatically generated when you issue invoices, record expenses, or reconcile bank statements.' : 'Change or reset the filters.'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.slice(0, shown).map((entry) => (
            <div key={entry.id} className="gold-glass-panel rounded-2xl p-6 transition-all hover:border-[#d4af37]/30 hover:shadow-[0_0_20px_rgba(212,175,55,0.05)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800/80">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold text-white font-mono bg-zinc-900 px-2 py-0.5 rounded">{entry.entry_number}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#f5d77f] border border-[#d4af37]/20">{entry.source_module.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans">{entry.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-white bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800 inline-block">{entry.entry_date}</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-zinc-500 uppercase tracking-wider border-b border-zinc-800/60">
                      <th className="pb-3 pl-2 font-medium">Account</th>
                      <th className="pb-3 text-right font-medium w-1/4">Debit</th>
                      <th className="pb-3 pr-2 text-right font-medium w-1/4">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {entry.lines.map((line) => (
                      <tr key={line.id} className="group hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 pl-2 text-zinc-300 font-sans font-medium flex items-center gap-2">
                          {line.credit_amount > 0 && <span className="w-4" />}
                          {line.account_name}
                        </td>
                        <td className="py-3 text-right">{line.debit_amount > 0 ? <span className="text-white font-bold">Rp {line.debit_amount.toLocaleString('en-US')}</span> : <span className="text-zinc-700">-</span>}</td>
                        <td className="py-3 pr-2 text-right">{line.credit_amount > 0 ? <span className="text-[#d4af37] font-bold">Rp {line.credit_amount.toLocaleString('en-US')}</span> : <span className="text-zinc-700">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-700/80 bg-zinc-900/30">
                      <td className="py-3 pl-2 font-bold text-zinc-400 uppercase tracking-widest text-[10px]">Totals</td>
                      <td className="py-3 text-right font-bold text-white">Rp {entry.lines.reduce((sum, l) => sum + l.debit_amount, 0).toLocaleString('en-US')}</td>
                      <td className="py-3 pr-2 text-right font-bold text-[#d4af37]">Rp {entry.lines.reduce((sum, l) => sum + l.credit_amount, 0).toLocaleString('en-US')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
          {filtered.length > shown && (
            <div className="flex justify-center">
              <button onClick={() => setShown((n) => n + PAGE)} className="rounded-lg border border-[#d4af37]/40 px-6 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/10">Show more ({filtered.length - shown} left)</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
