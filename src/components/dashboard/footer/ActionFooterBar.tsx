'use client';

import React from 'react';
import { Plus, Receipt } from 'lucide-react';

export function ActionFooterBar() {
  const metrics = [
    { label: 'AVG DAILY', value: '4.57c' },
    { label: 'REV PER INV', value: '$10,000.00' },
    { label: 'HOURLY RATE', value: '$150.00' },
    { label: 'DISCOUNT', value: '5.00%' },
    { label: 'EPOCH', value: '$1 epo' },
  ];

  return (
    <footer className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6">
      {/* Primary Glowing Pill Buttons */}
      <div className="flex items-center gap-4">
        {/* Cyber-Cyan Pill Button */}
        <button className="px-7 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          NEW INVOICE
        </button>

        {/* Copper-Amber Pill Button */}
        <button className="px-7 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
          <Receipt className="w-4 h-4" />
          RECORD EXPENSE
        </button>
      </div>

      {/* Row of Tiny Summary Data Boxes */}
      <div className="flex items-center gap-4 overflow-x-auto">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-center min-w-[85px]"
          >
            <span className="text-[9px] text-slate-400 font-mono uppercase block">
              {m.label}
            </span>
            <span className="text-xs font-bold text-slate-200 font-mono">
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </footer>
  );
}
