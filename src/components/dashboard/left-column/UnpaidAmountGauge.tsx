'use client';

import React from 'react';

interface UnpaidAmountGaugeProps {
  amount?: number | string;
  overdueCount?: number;
}

export function UnpaidAmountGauge({ amount = 810, overdueCount = 4 }: UnpaidAmountGaugeProps) {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 flex flex-col items-center justify-between">
      <div className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-200 mb-2">
        <span>UNPAID INVOICES</span>
        <span className="text-[10px] text-[#f5d77f] font-mono">Days Overdue: {overdueCount}</span>
      </div>

      {/* Glowing Luxury Gold Circular Arc Gauge */}
      <div className="relative w-44 h-44 flex items-center justify-center my-2">
        <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
          {/* Background Obsidian Track */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#18181b"
            strokeWidth="9"
            strokeDasharray="210 100"
            strokeLinecap="round"
          />
          {/* Glowing Brushed Gold Arc */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#d4af37"
            strokeWidth="9"
            strokeDasharray="170 140"
            strokeLinecap="round"
            className="drop-shadow-[0_0_15px_rgba(212,175,55,0.65)]"
          />
        </svg>

        {/* Central Gold Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_0_12px_rgba(245,215,127,0.45)]">
            {amount}
          </span>
          <span className="text-[10px] font-mono text-[#f5d77f] tracking-widest uppercase mt-0.5">
            UNPAID RATIO
          </span>
        </div>
      </div>

      {/* Footer Gold Spark Indicators */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-[#d4af37]/20">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
          <span>LIVE AR STREAM</span>
        </div>
        <span className="text-[#f5d77f] font-bold">NET 15 AUTO</span>
      </div>
    </div>
  );
}
