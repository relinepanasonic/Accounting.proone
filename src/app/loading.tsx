import React from 'react';
import { Loader2 } from 'lucide-react';

export default function RootLoading() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-[60vh] animate-in fade-in duration-300">
      <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mb-4" />
      <div className="text-zinc-400 font-mono text-sm uppercase tracking-widest animate-pulse">Loading Module...</div>
    </div>
  );
}
