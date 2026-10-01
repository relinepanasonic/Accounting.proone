'use client';

import React, { useState, useTransition } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { setClientServiceEnd, setMonthlyReportSent } from '@/app/actions/kpi';

/** Admin: tick the monthly report as sent to the client. */
export function ReportToggle({ clientId, month, sent }: { clientId: string; month: string; sent: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col items-end">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError('');
            const res = await setMonthlyReportSent(clientId, month, !sent);
            if (!res.success) setError(res.error || 'Could not save.');
          })
        }
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          sent ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-[#d4af37]/50 hover:text-[#f5d77f]'
        }`}
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : sent ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
        {sent ? 'Sent' : 'Mark sent'}
      </button>
      {error && <span className="mt-1 max-w-[200px] text-right text-[10px] text-red-400">{error}</span>}
    </div>
  );
}

/** Sales: when the client's service runs out. 30 days before = warning, the day after = churn. */
export function EndDateEditor({ clientId, value }: { clientId: string; value: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          defaultValue={value || ''}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              setError('');
              const res = await setClientServiceEnd(clientId, e.target.value || null);
              if (!res.success) setError(res.error || 'Could not save.');
            })
          }
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 [color-scheme:dark] focus:border-[#d4af37] focus:outline-none"
        />
        {pending && <Loader2 className="h-3 w-3 animate-spin text-[#d4af37]" />}
      </div>
      {error && <span className="mt-1 max-w-[200px] text-right text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
