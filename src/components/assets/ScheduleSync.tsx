'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { runMonthlyDepreciation } from '@/app/actions/fixed-assets';

/** Syncs the Schedule Expense when the page opens (payments that fell due are posted) and on the button. */
export function ScheduleSync() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState('');
  const once = useRef(false);

  const run = (quiet: boolean) => {
    start(async () => {
      const res = await runMonthlyDepreciation();
      if (!res.success) { setNote(res.error || 'Could not sync.'); return; }
      const posted = (res as any).processedCount || 0;
      const created = (res as any).created || 0;
      if (posted || created) { setNote(`${created ? `${created} payment(s) scheduled. ` : ''}${posted ? `${posted} posted to the ledger.` : ''}`.trim()); router.refresh(); }
      else if (!quiet) setNote('Everything is up to date.');
    });
  };

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    run(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-3">
      {note && <span className={`text-xs font-bold ${/Run supabase|Could not|error/i.test(note) ? 'text-red-400' : 'text-emerald-400'}`}>{note}</span>}
      <button
        type="button"
        onClick={() => run(false)}
        disabled={pending}
        className="flex items-center gap-2 rounded-xl border border-[#d4af37]/40 bg-zinc-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#f5d77f] transition-all hover:bg-[#d4af37] hover:text-black disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Syncing...' : 'Sync now'}
      </button>
    </div>
  );
}
