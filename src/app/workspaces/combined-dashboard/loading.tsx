'use client';

import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Loader2 } from 'lucide-react';

const STEPS = ['Checking your access', 'Reading invoices', 'Reading expenses and clients', 'Building the charts'];

/** Shown the moment you press Generate: an animated screen with a clock, so you can tell "working" from "stuck". */
export default function CombinedDashboardLoading() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const step = Math.min(STEPS.length - 1, Math.floor(sec / 2));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0b0c10] px-4 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full border border-[#d4af37]/30" />
        <span className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-[#d4af37] border-r-[#f5d77f]" />
        <LayoutDashboard className="h-8 w-8 text-[#f5d77f]" />
      </div>
      <div>
        <h1 className="font-serif text-xl font-bold text-white">Building your combined dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">{STEPS[step]}...</p>
      </div>
      <div className="w-72 max-w-full">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d77f]" />
        </div>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">{sec}s</p>
      </div>
      {sec >= 15 && (
        <p className="flex max-w-sm items-center gap-2 text-xs text-amber-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> This is taking longer than usual. If nothing appears within a minute, go back and try again.
        </p>
      )}
      <style>{'@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
    </div>
  );
}
