'use client';

import React, { useTransition, useState } from 'react';
import { PlayCircle, Check, AlertCircle } from 'lucide-react';
import { runMonthlyDepreciation } from '@/app/actions/fixed-assets';

export function RunDepreciationButton() {
  const [isPending, startTransition] = useTransition();
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRun = () => {
    startTransition(async () => {
      const res = await runMonthlyDepreciation();
      if (res.success) {
        setResultMsg({ type: 'success', text: `Success! Posted ${res.processedCount} depreciation entries.` });
        setTimeout(() => setResultMsg(null), 5000);
      } else {
        setResultMsg({ type: 'error', text: res.error || 'Failed to run depreciation.' });
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      {resultMsg && (
        <span className={`text-xs font-bold ${resultMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
          {resultMsg.text}
        </span>
      )}
      <button
        onClick={handleRun}
        disabled={isPending}
        className="px-6 py-2.5 rounded-xl bg-zinc-900 border border-[#d4af37]/40 text-[#f5d77f] font-bold uppercase tracking-wider text-[11px] hover:bg-[#d4af37] hover:text-black hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPending ? <span className="animate-spin text-lg leading-none">⟳</span> : <PlayCircle className="w-4 h-4" />}
        <span>{isPending ? 'Processing...' : 'Run Monthly Depreciation'}</span>
      </button>
    </div>
  );
}
