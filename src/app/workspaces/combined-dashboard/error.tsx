'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/** The dashboard crashed: say so, show why, and offer a retry. */
export default function CombinedDashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0c10] px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300"><AlertTriangle className="h-8 w-8" /></div>
      <h1 className="font-serif text-xl font-bold text-white">The dashboard could not load</h1>
      <p className="max-w-md text-sm text-zinc-400">Something went wrong while reading the numbers. Nothing was changed. Try again, or go back and pick the companies again.</p>
      {error?.digest && <p className="font-mono text-[11px] text-zinc-600">Error code: {error.digest}</p>}
      <div className="flex gap-3">
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-black"><RefreshCw className="h-4 w-4" /> Try again</button>
        <a href="/workspaces/combined-setup" className="rounded-lg border border-zinc-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:border-zinc-500">Back</a>
      </div>
    </div>
  );
}
