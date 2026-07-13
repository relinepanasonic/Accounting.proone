'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';

export function ActionFooterBar() {
  const metrics = [
    { label: 'AVG DAILY', value: '$4,570.00' },
    { label: 'REV PER INV', value: '$10,000.00' },
    { label: 'HOURLY RATE', value: '$150.00' },
    { label: 'COLLECTED', value: '94.80%' },
    { label: 'DSO RATIO', value: '14 DAYS' },
  ];

  return (
    <footer className="mt-8 pt-6 border-t border-[#d4af37]/20 flex flex-col md:flex-row items-center justify-between gap-6">
      {/* Primary Luxury Brushed Gold Pill Buttons */}
      <div className="flex items-center gap-4">
        <Link
          href="/invoices/new"
          className="gold-btn px-7 py-3 rounded-full text-xs uppercase tracking-wider flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>NEW INVOICE</span>
        </Link>

        <Link
          href="/expenses/new"
          className="px-7 py-3 rounded-full bg-zinc-900 border border-[#d4af37]/50 hover:bg-[#d4af37]/15 text-[#f5d77f] font-extrabold text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(212,175,55,0.2)] transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
        >
          <Receipt className="w-4 h-4" />
          <span>RECORD EXPENSE</span>
        </Link>
      </div>

      {/* Row of Tiny Summary Data Boxes */}
      <div className="flex items-center gap-3 overflow-x-auto">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="gold-glass-panel rounded-xl px-3.5 py-2 text-center min-w-[95px] border border-[#d4af37]/20"
          >
            <span className="text-[9px] text-zinc-400 font-mono uppercase block">
              {m.label}
            </span>
            <span className="text-xs font-bold text-[#f5d77f] font-mono mt-0.5 block">
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </footer>
  );
}
