'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { addBankAccount } from '@/app/actions/bank-book';

const field = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none';

/** Buku Bank > "Add bank": a new bank account of this company (it also gets its own COA account, so it can be reconciled). */
export function AddBankButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const save = () => {
    setError('');
    start(async () => {
      const res = await addBankAccount({ bankName, accountNumber, accountName });
      if (!res.success) { setError(res.error || 'Could not add the bank.'); return; }
      setBankName(''); setAccountNumber(''); setAccountName(''); setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:brightness-125">
        <Plus className="h-4 w-4" /> Add bank
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-6" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-extrabold text-white">Add a bank</h3>
              <p className="mt-1 text-xs text-zinc-500">A new bank account of this company. Then you can upload its statements and reconcile it.</p>
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
            </div>
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-300">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
              <button type="button" disabled={pending || !bankName.trim() || !accountNumber.trim()} onClick={save} className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40">{pending ? 'Saving...' : 'Add bank'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
