'use client';

import React, { useRef, useState } from 'react';
import { saveBankOpeningBalances } from '@/app/actions/opening-balances';
import { Landmark, CheckCircle2 } from 'lucide-react';

export function BankOpeningBalanceForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    await saveBankOpeningBalances(formData);
    setIsSuccess(true);
    formRef.current?.reset();
    setTimeout(() => setIsSuccess(false), 3000);
  };

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4 relative">
      {isSuccess && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 text-[#f5d77f] font-bold">
            <CheckCircle2 className="w-5 h-5" />
            <span>JOURNAL ENTRY POSTED</span>
          </div>
        </div>
      )}
      
      <div>
        <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Asset Account Name (e.g., Bank Jago)</label>
        <input 
          name="bankName"
          required
          placeholder="e.g. Bank BCA 1234..."
          className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Starting Balance (Rp)</label>
          <input 
            type="number"
            name="balance"
            required
            placeholder="0"
            className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">As Of Date (Saldo Awal Date)</label>
          <input 
            type="date"
            name="date"
            required
            defaultValue="2025-12-31"
            className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 font-mono"
          />
        </div>
      </div>

      <button 
        type="submit"
        className="w-full gold-btn py-3 rounded-xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2"
      >
        <Landmark className="w-4 h-4" />
        Post Opening Balance
      </button>
    </form>
  );
}
