import React from 'react';
import { Loader2 } from 'lucide-react';

export default function SalesLoading() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-[50vh] animate-in fade-in duration-300">
      <Loader2 className="w-10 h-10 text-[#d4af37] animate-spin mb-4" />
      <div className="text-zinc-400 font-mono text-xs uppercase tracking-widest animate-pulse">Loading Module...</div>
    </div>
  );
}
