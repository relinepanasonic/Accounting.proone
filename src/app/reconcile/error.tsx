'use client';

import { useEffect } from 'react';

export default function ReconcileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Reconcile page error:', error);
  }, [error]);

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8">
      <div className="gold-glass-panel rounded-2xl p-12 text-center max-w-2xl mx-auto">
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-4">
          Page Error Detected
        </h2>
        <div className="bg-zinc-950 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-mono text-red-300 break-all">{error.message}</p>
          {error.digest && (
            <p className="text-[10px] font-mono text-zinc-500 mt-2">Digest: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="gold-btn px-6 py-2 rounded-full text-xs uppercase tracking-wider"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
