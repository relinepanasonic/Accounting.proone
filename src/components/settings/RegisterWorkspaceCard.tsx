'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, PlusCircle, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { createWorkspace } from '@/app/actions/workspace';

export function RegisterWorkspaceCard() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setErrorMsg('');
    setSuccessMsg('');

    startTransition(async () => {
      const res = await createWorkspace(companyName.trim());
      if (res.success) {
        setSuccessMsg(`Registered "${companyName.trim()}" successfully! Switching workspace...`);
        setCompanyName('');
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to register new enterprise tenant.');
      }
    });
  };

  return (
    <div className="gold-glass-panel rounded-3xl p-6 sm:p-8 mt-8 border border-[#d4af37]/40 shadow-[0_0_40px_rgba(212,175,55,0.15)] relative overflow-hidden">
      {/* Decorative radial glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d4af37]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#f5d77f]">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
              REGISTER NEW ENTERPRISE TENANT
            </h3>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              ISOLATED MULTI-TENANT LEDGER & COMPANY REGISTRY • SUPERADMIN CLEARANCE
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] uppercase px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40">
          TENANT DEPLOYMENT
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-4 mb-5 rounded-xl bg-red-950/60 border border-red-700 text-red-200 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 p-4 mb-5 rounded-xl bg-[#d4af37]/20 border border-[#d4af37] text-[#f5d77f] text-xs font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#f5d77f]" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
            NEW COMPANY OR LEGAL ENTITY NAME *
          </label>
          <input
            type="text"
            placeholder="e.g. PT Pintu Langit Inovasi Global"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={isPending}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all font-sans"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !companyName.trim()}
            className="gold-btn inline-flex items-center justify-center gap-2.5 px-8 py-3.5 min-h-[44px] rounded-full text-xs uppercase tracking-wider disabled:opacity-60 transition-all shadow-[0_0_25px_rgba(212,175,55,0.4)] font-extrabold"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <PlusCircle className="w-4 h-4 text-black" />
            )}
            <span>
              {isPending ? 'DEPLOYING TENANT...' : 'Register & Switch Workspace'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
