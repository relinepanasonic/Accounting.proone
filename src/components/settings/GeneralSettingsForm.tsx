'use client';

import React, { useState, useTransition } from 'react';
import { Save, AlertCircle, Check, Loader2 } from 'lucide-react';
import { updateGeneralSettings } from '@/app/actions/settings';

interface GeneralSettingsFormProps {
  initialName: string;
  initialTaxRate: number;
  initialInstructions: string;
}

export function GeneralSettingsForm({
  initialName = 'Professor Toko Online',
  initialTaxRate = 11,
  initialInstructions = 'BCA Virtual Account: 88019-212-5120\nBank Mandiri Corporate: 102-000-988-111',
}: Partial<GeneralSettingsFormProps>) {
  const [name, setName] = useState(initialName);
  const [taxRatePercent, setTaxRatePercent] = useState(initialTaxRate);
  const [paymentInstructions, setPaymentInstructions] = useState(initialInstructions);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    startTransition(async () => {
      try {
        const res = await updateGeneralSettings({
          name,
          taxRatePercent: Number(taxRatePercent),
          paymentInstructions,
        });

        if (!res.success) {
          setStatusMsg({ type: 'error', text: res.error || 'Failed to save settings.' });
        } else {
          setStatusMsg({
            type: 'success',
            text: res.warning || 'Workspace identity and bank instructions saved successfully.',
          });
        }
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err?.message || 'Unexpected error.' });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="gold-glass-panel rounded-3xl p-8 max-w-3xl space-y-6">
      <div className="border-b border-[#d4af37]/20 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          GENERAL WORKSPACE IDENTITY & TAX PROFILE
        </h2>
        <p className="text-xs text-[#d4af37] font-mono mt-1">
          CONFIGURE ENTERPRISE LEGAL ENTITY AND AUTOMATED PPN / INVOICE TERMS
        </p>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-xs font-mono shadow-sm border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'bg-[#d4af37]/15 border-[#d4af37]/60 text-[#f5d77f]'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-[#f5d77f]" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
            WORKSPACE / ENTERPRISE NAME *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white font-sans focus:outline-none focus:border-[#d4af37] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
            DEFAULT TAX RATE (%) • INDONESIAN PPN VALUE
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="100"
            required
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(Number(e.target.value))}
            className="w-48 bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
            DEFAULT PAYMENT / BANK INSTRUCTIONS (RENDERED ON PDF INVOICES)
          </label>
          <textarea
            rows={4}
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            placeholder="Enter Bank Account details, Virtual Accounts, and terms..."
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-[#d4af37] transition-all"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-[#d4af37]/20 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="gold-btn inline-flex items-center gap-2 px-8 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Save className="w-4 h-4 text-black" />
          )}
          <span>SAVE GENERAL CONFIG</span>
        </button>
      </div>
    </form>
  );
}
