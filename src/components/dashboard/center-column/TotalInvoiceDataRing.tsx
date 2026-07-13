'use client';

import React from 'react';

interface TotalInvoiceDataRingProps {
  totalVolume?: number;
  overdueCount?: number;
  paidCount?: number;
  avgAmount?: number;
}

export function TotalInvoiceDataRing({
  totalVolume = 1498700000,
  overdueCount = 3,
  paidCount = 22,
  avgAmount = 68000000,
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
          <span className="text-lg font-extrabold font-mono text-white tracking-tight mt-0.5">
            Rp 1,49 Miliar
          </span>
          <span className="text-[10px] text-[#f5d77f] font-mono mt-1">
            Realtime IDR
          </span>
        </div>
      </div>

      {/* Bottom micro telemetry strip */}
      <div className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 pt-3 border-t border-[#d4af37]/20">
        <div>
          <span className="block text-[9px] text-zinc-500 uppercase">AVG INVOICE</span>
          <span className="text-[#f5d77f] font-bold">Rp 68.000.000</span>
        </div>
        <div className="text-right">
          <span className="block text-[9px] text-zinc-500 uppercase">RECENCY</span>
          <span className="text-zinc-300">INSTANT TELEMETRY</span>
        </div>
      </div>
    </div>
  );
}
