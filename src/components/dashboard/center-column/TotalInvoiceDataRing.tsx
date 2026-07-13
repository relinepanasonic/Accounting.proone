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
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden flex flex-col items-center justify-center">
      {/* Top micro status strip */}
      <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Overdue Inv: <strong className="text-amber-400">{overdueCount}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>Paid Inv: <strong className="text-cyan-400">{paidCount}</strong></span>
        </div>
      </div>

      {/* Cybernetic Radial Node Network */}
      <div className="relative w-full h-48 flex items-center justify-center">
        {/* Decorative SVG Connection lines */}
        <svg viewBox="0 0 320 180" className="absolute inset-0 w-full h-full pointer-events-none">
          <circle cx="160" cy="90" r="64" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="160" cy="90" r="82" fill="none" stroke="#06b6d4" strokeWidth="0.5" strokeOpacity="0.3" />
          
          {/* Radial Spokes */}
          <line x1="160" y1="90" x2="60" y2="40" stroke="#1e293b" strokeWidth="1" />
          <line x1="160" y1="90" x2="260" y2="40" stroke="#1e293b" strokeWidth="1" />
          <line x1="160" y1="90" x2="60" y2="140" stroke="#1e293b" strokeWidth="1" />
          <line x1="160" y1="90" x2="260" y2="140" stroke="#1e293b" strokeWidth="1" />

          {/* Glowing Nodes */}
          <circle cx="60" cy="40" r="14" fill="#0f172a" stroke="#f97316" strokeWidth="1.5" />
          <circle cx="260" cy="40" r="14" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="60" cy="140" r="14" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="260" cy="140" r="14" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
        </svg>

        {/* Central Hub Core */}
        <div className="z-10 bg-slate-950/90 border border-cyan-500/40 rounded-full w-36 h-36 flex flex-col items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.25)]">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
            Invoices Total
          </span>
          <span className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
            ${Math.round(totalVolume).toLocaleString()}
          </span>
          <span className="text-[10px] text-cyan-400 font-mono mt-1">
            Avg: ${Math.round(avgAmount).toLocaleString()}
          </span>
        </div>

        {/* Surrounding Node Labels */}
        <div className="absolute top-1 left-6 text-[10px] font-mono text-amber-400">
          Overdue: {overdueCount}
        </div>
        <div className="absolute top-1 right-6 text-[10px] font-mono text-cyan-400">
          Paid: {paidCount}
        </div>
        <div className="absolute bottom-2 left-6 text-[10px] font-mono text-slate-300">
          NET 15
        </div>
        <div className="absolute bottom-2 right-6 text-[10px] font-mono text-cyan-300">
          REALTIME
        </div>
      </div>

      {/* Footer System Integrity Status */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
        <span className="uppercase text-slate-400">SYNC: SUPABASE CORE</span>
        <span className="text-cyan-400 font-bold">LIVE METRIC</span>
      </div>
    </div>
  );
}
