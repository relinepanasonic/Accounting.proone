'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, Plus, Pencil, Trash2, ChevronDown, Star } from 'lucide-react';
import { addBankAccount, updateBankAccount, deleteBankAccount, setLastYearBalance } from '@/app/actions/bank-book';
import type { BankBookAccount } from '@/components/bank-book/BankBookTable';

const field = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none';
const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

/** The form for a new bank and for editing one. */
function BankForm({ bank, onClose }: { bank: BankBookAccount | null; onClose: () => void }) {
  const router = useRouter();
  const [bankName, setBankName] = useState(bank?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(bank?.accountNumber || '');
  const [accountName, setAccountName] = useState(bank?.accountName || '');
  const [isDefault, setIsDefault] = useState(Boolean(bank?.isDefault));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const save = () => {
    setError('');
    start(async () => {
      const res = bank ? await updateBankAccount(bank.id, { bankName, accountNumber, accountName, isDefault }) : await addBankAccount({ bankName, accountNumber, accountName });
      if (!res.success) { setError(res.error || 'Could not save.'); return; }
      onClose(); router.refresh();
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !pending && onClose()}>
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-6" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-extrabold text-white">{bank ? 'Edit bank' : 'Add a bank'}</h3>
          <p className="mt-1 text-xs text-zinc-500">{bank ? 'Change how this bank account is written.' : 'A new bank account of this company. Then you can upload its statements and reconcile it.'}</p>
        </div>
        <div className="space-y-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Bank name
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. BCA, Jago, Mandiri" autoFocus className={`${field} mt-1 normal-case`} />
          </label>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Account number
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" placeholder="e.g. 4295775778" className={`${field} mt-1 normal-case`} />
          </label>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Account name
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name on the account" className={`${field} mt-1 normal-case`} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
          </label>
          {bank && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-[#d4af37]" /> Default bank (printed on new invoices)
            </label>
          )}
        </div>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-300">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
          <button type="button" disabled={pending || !bankName.trim() || !accountNumber.trim()} onClick={save} className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40">{pending ? 'Saving...' : bank ? 'Save' : 'Add bank'}</button>
        </div>
      </div>
    </div>
  );
}

/** The balance at the end of last year: one direct income on 31 Dec 2025. */
function LastYear({ bank, canManage }: { bank: BankBookAccount; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(bank.lastYear ? String(Math.round(bank.lastYear)) : '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const save = () => {
    setError('');
    start(async () => {
      const res = await setLastYearBalance(bank.id, Number(text.replace(/[^\d]/g, '') || 0));
      if (!res.success) { setError(res.error || 'Could not save.'); return; }
      setEditing(false); router.refresh();
    });
  };
  if (editing) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <input value={text} onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" autoFocus placeholder="0" onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} className="w-36 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-right font-mono text-xs text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none" />
          <button type="button" disabled={pending} onClick={save} className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-bold text-[#f5d77f]">{pending ? '...' : 'Save'}</button>
          <button type="button" onClick={() => { setEditing(false); setError(''); }} className="text-[11px] text-zinc-500 hover:text-white">Cancel</button>
        </div>
        {error && <div className="mt-1 max-w-[260px] text-[10px] text-red-400">{error}</div>}
      </div>
    );
  }
  return (
    <button type="button" disabled={!canManage} onClick={() => setEditing(true)} title="Last year balance: saved as a direct income on 31 Dec 2025" className={`font-mono text-xs ${bank.lastYear ? 'text-emerald-300' : 'text-zinc-600'} ${canManage ? 'hover:text-[#f5d77f]' : ''}`}>
      {bank.lastYear ? rupiah(bank.lastYear) : canManage ? '+ set' : '-'}
    </button>
  );
}

/** Buku Bank > Banks: the list of bank accounts of this company, to add, edit and delete, with the balance of last year. */
export function BanksPanel({ banks, canManage }: { banks: BankBookAccount[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(banks.length === 0);
  const [form, setForm] = useState<{ bank: BankBookAccount | null } | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const remove = (b: BankBookAccount) => {
    if (!window.confirm(`Delete ${b.bankName}${b.accountNumber ? ` | ${b.accountNumber}` : ''}?`)) return;
    setError('');
    start(async () => {
      const res = await deleteBankAccount(b.id);
      if (!res.success) setError(res.error || 'Could not delete.'); else router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0e0f14]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
        <span className="flex items-center gap-2.5 text-sm font-extrabold text-white"><Landmark className="h-4 w-4 text-[#d4af37]" /> Bank accounts <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300">{banks.length}</span></span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-800 p-5">
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-300">{error}</div>}
          {banks.length === 0 ? (
            <div className="py-6 text-center text-sm text-zinc-500">No bank account yet. {canManage ? 'Add the first one.' : ''}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr><th className="py-2 pr-4 font-bold">Bank</th><th className="py-2 pr-4 font-bold">Account number</th><th className="py-2 pr-4 font-bold">Account name</th><th className="py-2 pr-4 text-right font-bold">Last year balance <span className="font-normal normal-case text-zinc-600">(31 Dec 2025)</span></th>{canManage && <th className="py-2 text-right font-bold">Actions</th>}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {banks.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-900/40">
                      <td className="py-3 pr-4 font-bold text-zinc-100"><span className="inline-flex items-center gap-1.5">{b.bankName}{b.isDefault && <Star className="h-3 w-3 fill-[#d4af37] text-[#d4af37]" aria-label="Default bank" />}</span></td>
                      <td className="py-3 pr-4 font-mono text-xs text-zinc-300">{b.accountNumber || '-'}</td>
                      <td className="py-3 pr-4 text-zinc-300">{b.accountName || '-'}</td>
                      <td className="py-3 pr-4 text-right"><LastYear bank={b} canManage={canManage} /></td>
                      {canManage && (
                        <td className="py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={() => setForm({ bank: b })} title="Edit" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" disabled={pending} onClick={() => remove(b)} title="Delete" className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[11px] text-zinc-500">The last year balance is saved as one direct income on 31 Dec 2025 with the note &quot;Last year balance&quot;. A bank that still has statement lines or ledger entries cannot be deleted.</p>
            {canManage && <button type="button" onClick={() => setForm({ bank: null })} className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:brightness-125"><Plus className="h-4 w-4" /> Add bank</button>}
          </div>
        </div>
      )}
      {form && <BankForm bank={form.bank} onClose={() => setForm(null)} />}
    </div>
  );
}
