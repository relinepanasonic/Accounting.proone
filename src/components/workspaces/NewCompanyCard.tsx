'use client';

import React, { useState, useTransition } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { createWorkspace } from '@/app/actions/workspace';

/** First landing page: "Create new company". A company has its own invoices, ledger, COA and team; you become its superadmin and enter it at once. */
export function NewCompanyCard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const create = () => {
    if (!name.trim()) return;
    setError('');
    start(async () => {
      const res = await createWorkspace(name.trim());
      if (!res.success) { setError(res.error || 'Could not create the company.'); return; }
      window.location.assign('/'); // the new company is already the active one (cookie set by the server)
    });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#d4af37]/50 px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#f5d77f] transition-all hover:bg-[#d4af37]/10">
        <Plus className="h-5 w-5" /> Create new company
      </button>
    );
  }
  return (
    <div className="mt-4 w-full max-w-md rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-5 text-left">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 p-2 text-[#f5d77f]"><Building2 className="h-4 w-4" /></div>
        <div>
          <div className="text-sm font-extrabold text-white">New company</div>
          <div className="text-[11px] text-zinc-500">Its own invoices, ledger, COA and team. You become its superadmin.</div>
        </div>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} disabled={pending} autoFocus placeholder="Company name, e.g. PT Pintu Langit Inovasi Global" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none" />
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" disabled={pending} onClick={() => { setOpen(false); setError(''); }} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
        <button type="button" disabled={pending || !name.trim()} onClick={create} className="inline-flex items-center gap-2 rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create company
        </button>
      </div>
    </div>
  );
}
