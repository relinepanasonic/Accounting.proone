'use client';

import React from 'react';

interface TotalInvoiceDataRingProps {
  totalVolume?: number;
  overdueCount?: number;
  paidCount?: number;
  avgAmount?: number;
}

export function TotalInvoiceDataRing({
  totalVolume = 149870,
  overdueCount = 3,
  paidCount = 22,
  avgAmount = 6800,
}: TotalInvoiceDataRingProps) {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 relative overflow-hidden flex flex-col items-center justify-center">
      {/* Top micro status strip */}
      <div className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#f5d77f] animate-pulse"></span>
          <span>Overdue Inv: <strong className="text-[#f5d77f]">{overdueCount}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse"></span>
          <span>Paid Inv: <strong className="text-[#d4af37]">{paidCount}</strong></span>
        </div>
      </div>

      {/* Luxury Gold Radial Node Network */}
      <div className="relative w-full h-48 flex items-center justify-center">
        {/* Decorative SVG Connection lines */}
        <svg viewBox="0 0 320 180" className="absolute inset-0 w-full h-full pointer-events-none">
          <circle cx="160" cy="90" r="64" fill="none" stroke="#27272a" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="160" cy="90" r="82" fill="none" stroke="#d4af37" strokeWidth="0.5" strokeOpacity="0.3" />
          
          {/* Radial Spokes */}
          <line x1="160" y1="90" x2="60" y2="40" stroke="#27272a" strokeWidth="1" />
          <line x1="160" y1="90" x2="260" y2="40" stroke="#27272a" strokeWidth="1" />
          <line x1="160" y1="90" x2="60" y2="140" stroke="#27272a" strokeWidth="1" />
          <line x1="160" y1="90" x2="260" y2="140" stroke="#27272a" strokeWidth="1" />

          {/* Glowing Brushed Gold Nodes */}
          <circle cx="60" cy="40" r="14" fill="#09090b" stroke="#f5d77f" strokeWidth="1.5" />
          <circle cx="260" cy="40" r="14" fill="#09090b" stroke="#d4af37" strokeWidth="1.5" />
          <circle cx="60" cy="140" r="14" fill="#09090b" stroke="#d4af37" strokeWidth="1.5" />
          <circle cx="260" cy="140" r="14" fill="#09090b" stroke="#d4af37" strokeWidth="1.5" />
        </svg>

        {/* Central Gold Hub Core */}
        <div className="z-10 bg-zinc-950/95 border border-[#d4af37]/40 rounded-full w-36 h-36 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.25)]">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">
            Invoices Total
          </span>
          <span className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
            ${Math.round(totalVolume).toLocaleString()}
          </span>
          <span className="text-[10px] text-[#f5d77f] font-mono mt-1">
            Avg: ${Math.round(avgAmount).toLocaleString()}
          </span>
        </div>

        {/* Surrounding Node Labels */}
        <div className="absolute top-1 left-6 text-[10px] font-mono text-[#f5d77f]">
          Overdue: {overdueCount}
        </div>
        <div className="absolute top-1 right-6 text-[10px] font-mono text-[#d4af37]">
          Paid: {paidCount}
        </div>
        <div className="absolute bottom-2 left-6 text-[10px] font-mono text-zinc-300">
          NET 15
        </div>
        <div className="absolute bottom-2 right-6 text-[10px] font-mono text-[#f5d77f]">
          REALTIME
        </div>
      </div>

      {/* Footer System Integrity Status */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-[#d4af37]/20">
        <span className="uppercase text-zinc-400">SYNC: SUPABASE CORE</span>
        <span className="text-[#d4af37] font-bold">LIVE METRIC</span>
      </div>
    </div>
  );
}
