'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { Search, Pencil, Trash2, Check, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { updateBankLine, deleteBankLine } from '@/app/actions/bank-book';
import { BankStatementUpload } from '@/components/bank-book/BankStatementUpload';

export interface BankBookLine { id: string; bankAccountId: string; date: string; counterparty: string; details: string; rekFrom: string; notes: string; amount: number; status: string; fileName: string }
export interface BankBookAccount { id: string; bankName: string; accountNumber: string; accountName: string }

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const rp = (n: number) => `Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;
const PAGE = 100;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** 2026-01-04 -> 04 Jan 2026 */
const dmy = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1] || iso.slice(5, 7)} ${iso.slice(0, 4)}` : iso);

/** Just the bank name; the account holder is added only when two accounts share the same bank name. */
const bankLabel = (b: BankBookAccount, all: BankBookAccount[]) =>
  all.filter((x) => x.bankName === b.bankName).length > 1 && b.accountName ? `${b.bankName} · ${b.accountName}` : b.bankName;

type SortKey = 'date' | 'bank' | 'counterparty' | 'details' | 'in' | 'out' | 'status';

/** Buku Bank: all stored statement lines, filtered by bank account, year, month, in/out and status, sortable from the header. */
export function BankBookTable({ lines: serverLines, banks, migrationMissing, canEdit = false }: { lines: BankBookLine[]; banks: BankBookAccount[]; migrationMissing: boolean; canEdit?: boolean }) {
  const [lines, setLines] = useState(serverLines);
  useEffect(() => setLines(serverLines), [serverLines]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ date: '', counterparty: '', details: '', notes: '', amount: '' });
  const [rowError, setRowError] = useState('');
  const [saving, startSave] = useTransition();
  const [bank, setBank] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [dir, setDir] = useState<'' | 'in' | 'out'>('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'date', asc: false });

  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);
  const bankName = (id: string) => bankById.get(id)?.bankName || '';
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
      return `${l.counterparty} ${l.details} ${l.rekFrom} ${l.notes}`.toLowerCase().includes(q) || (digits.length >= 3 && String(Math.round(Math.abs(l.amount))).includes(digits));
    });
  }, [lines, bank, year, month, dir, status, search]);

  const sorted = useMemo(() => {
    const val = (l: BankBookLine): string | number => {
      switch (sort.key) {
        case 'date': return l.date;
        case 'bank': return bankName(l.bankAccountId).toLowerCase();
        case 'counterparty': return l.counterparty.toLowerCase();
        case 'details': return `${l.details} ${l.rekFrom} ${l.notes}`.toLowerCase();
        case 'in': return l.amount > 0 ? l.amount : -1;
        case 'out': return l.amount < 0 ? -l.amount : -1;
        case 'status': return l.status;
      }
    };
    const sign = sort.asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, bankById]);

  const cashIn = filtered.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
  const cashOut = filtered.reduce((s, l) => s + (l.amount < 0 ? -l.amount : 0), 0);
  const total = cashIn - cashOut;
  const reset = () => { setBank(''); setYear(''); setMonth(''); setDir(''); setStatus(''); setSearch(''); setShown(PAGE); };
  const reflow = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setShown(PAGE); };
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key !== 'date' && key !== 'in' && key !== 'out' }));

  const startEdit = (l: BankBookLine) => {
    setRowError('');
    setEditing(l.id);
    setDraft({ date: l.date, counterparty: l.counterparty, details: l.details, notes: l.notes, amount: String(l.amount) });
  };
  const saveEdit = (id: string) => {
    const amount = Number(String(draft.amount).replace(/[^\d.-]/g, ''));
    startSave(async () => {
      const res = await updateBankLine(id, { date: draft.date, counterparty: draft.counterparty.trim(), details: draft.details.trim(), notes: draft.notes.trim(), amount });
      if (!res.success) { setRowError(res.error || 'Could not save.'); return; }
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, date: draft.date, counterparty: draft.counterparty.trim(), details: draft.details.trim(), notes: draft.notes.trim(), amount } : l)));
      setEditing(null);
    });
  };
  const removeLine = (l: BankBookLine) => {
    if (!window.confirm(`Delete this line?\n\n${dmy(l.date)}  ${l.counterparty}  ${rp(l.amount)}`)) return;
    startSave(async () => {
      const res = await deleteBankLine(l.id);
      if (!res.success) { setRowError(res.error || 'Could not delete.'); return; }
      setLines((prev) => prev.filter((x) => x.id !== l.id));
    });
  };

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.asc ? ArrowUp : ArrowDown;
    return (
      <th className={`px-4 py-3 font-bold ${right ? 'text-right' : ''}`}>
        <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${active ? 'text-[#f5d77f]' : ''}`}>
          {children}<Icon className={`h-3 w-3 ${active ? '' : 'opacity-40'}`} />
        </button>
      </th>
    );
  };

  const chip = (on: boolean) => `px-4 py-2 text-xs font-bold ${on ? 'bg-[#d4af37]/15 text-[#f5d77f]' : 'text-zinc-400 hover:bg-zinc-800/60'}`;

  return (
    <div className="space-y-5">
      <BankStatementUpload banks={banks} />

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
            {bankLabel(b, banks)} <span className="ml-1 font-mono text-[10px] opacity-70">{countByBank.get(b.id) || 0}</span>
          </button>
        ))}
      </div>

      {/* Filters: Year | Month | In / Out | Status */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14]/80 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => reflow(setSearch)(e.target.value)} placeholder="Name, details, notes or amount" className={`${field} w-full pl-8`} />
        </div>
        <select value={year} onChange={(e) => reflow(setYear)(e.target.value)} className={field}>
          <option value="">Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => reflow(setMonth)(e.target.value)} className={field}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        <div className="inline-flex overflow-hidden rounded-lg border border-zinc-800">
          <button onClick={() => reflow(setDir)('' as const)} className={chip(dir === '')}>All</button>
          <button onClick={() => reflow(setDir)('in' as const)} className={`border-l border-zinc-800 ${chip(dir === 'in')}`}>In</button>
          <button onClick={() => reflow(setDir)('out' as const)} className={`border-l border-zinc-800 ${chip(dir === 'out')}`}>Out</button>
        </div>
        <select value={status} onChange={(e) => reflow(setStatus)(e.target.value)} className={field}>
          <option value="">Status</option>
          <option value="unreconciled">Unreconciled</option>
          <option value="reconciled">Reconciled</option>
          <option value="ignored">Ignored</option>
        </select>
        {(bank || year || month || dir || status || search) && <button onClick={reset} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-500">Reset</button>}
      </div>

      {/* Cash In | Cash Out | Total */}
      <div className="grid grid-cols-3 gap-3">
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Cash In</div><div className="mt-1 font-serif text-xl font-bold text-emerald-400">{rp(cashIn)}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Cash Out</div><div className="mt-1 font-serif text-xl font-bold text-red-400">{rp(cashOut)}</div></div>
        <div className="gold-glass-panel rounded-xl p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total</div><div className={`mt-1 font-serif text-xl font-bold ${total < 0 ? 'text-red-400' : 'text-white'}`}>{total < 0 ? '-' : ''}{rp(total)}</div></div>
      </div>

      {/* Table */}
      <div className="gold-glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
              <tr>
                <Th k="date">Date</Th>
                <Th k="bank">Bank</Th>
                <Th k="counterparty">Source / Destination</Th>
                <Th k="details">Details</Th>
                <Th k="in" right>In</Th>
                <Th k="out" right>Out</Th>
                <Th k="status">Status</Th>
                {canEdit && <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {sorted.length === 0 && (
                <tr><td colSpan={canEdit ? 8 : 7} className="p-10 text-center text-zinc-500">{lines.length === 0 ? 'Nothing stored yet. Choose the bank account above and upload a statement.' : 'No line matches these filters.'}</td></tr>
              )}
              {sorted.slice(0, shown).map((l) => editing === l.id ? (
                <tr key={l.id} className="bg-[#d4af37]/5">
                  <td className="px-4 py-2"><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={`${field} w-[140px]`} /></td>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-400">{bankName(l.bankAccountId) || '-'}</td>
                  <td className="px-4 py-2"><input value={draft.counterparty} onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })} className={`${field} w-full min-w-[180px]`} /></td>
                  <td className="space-y-1 px-4 py-2">
                    <input value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} placeholder="Details" className={`${field} w-full min-w-[200px]`} />
                    <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" className={`${field} w-full`} />
                  </td>
                  <td className="px-4 py-2 text-right" colSpan={2}>
                    <input value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} inputMode="decimal" title="Money in is positive, money out is negative" className={`${field} w-[150px] text-right font-mono`} />
                    <div className="mt-1 text-[10px] text-zinc-500">in = +, out = -</div>
                  </td>
                  <td className="px-4 py-2">{rowError && <span className="text-[11px] text-red-400">{rowError}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button onClick={() => saveEdit(l.id)} disabled={saving} className="mr-1 rounded-lg border border-emerald-500/40 p-1.5 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50" title="Save"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setEditing(null); setRowError(''); }} className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:bg-zinc-800" title="Cancel"><X className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ) : (
                <tr key={l.id} className="hover:bg-zinc-900/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-300">{dmy(l.date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{bankName(l.bankAccountId) || '-'}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-zinc-100" title={l.counterparty}>{l.counterparty || '-'}</td>
                  <td className="max-w-[300px] truncate px-4 py-3 text-zinc-500" title={[l.details, l.rekFrom, l.notes].filter(Boolean).join(' · ')}>{[l.details, l.rekFrom, l.notes].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-emerald-400">{l.amount > 0 ? rp(l.amount) : ''}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-red-400">{l.amount < 0 ? rp(l.amount) : ''}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${l.status === 'reconciled' ? 'border-emerald-500/30 text-emerald-400' : l.status === 'ignored' ? 'border-zinc-600 text-zinc-500' : 'border-amber-500/30 text-amber-400'}`}>{l.status}</span>
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => startEdit(l)} disabled={saving} className="mr-1 rounded-lg border border-zinc-700 p-1.5 text-zinc-300 hover:border-[#d4af37]/60 hover:text-[#f5d77f]" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => removeLine(l)} disabled={saving} className="rounded-lg border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > shown && (
          <div className="flex justify-center border-t border-zinc-800/60 p-4">
            <button onClick={() => setShown((n) => n + PAGE)} className="rounded-lg border border-[#d4af37]/40 px-6 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/10">Show more ({sorted.length - shown} left)</button>
          </div>
        )}
      </div>
    </div>
  );
}
