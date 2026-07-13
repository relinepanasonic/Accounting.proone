'use client';

import React from 'react';

interface UnpaidAmountGaugeProps {
  amount?: number | string;
  overdueCount?: number;
}

export function UnpaidAmountGauge({ amount = 810, overdueCount = 4 }: UnpaidAmountGaugeProps) {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col items-center justify-between">
      <div className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
        <span>UNPAID INVOICES</span>
        <span className="text-[10px] text-amber-400 font-mono">Days Overdue: {overdueCount}</span>
      </div>

      {/* Glowing Circular Arc Gauge */}
      <div className="relative w-44 h-44 flex items-center justify-center my-2">
        <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
          {/* Background Track */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#1e293b"
            strokeWidth="9"
            strokeDasharray="210 100"
            strokeLinecap="round"
          />
          {/* Glowing Cyber-Cyan Arc */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="9"
            strokeDasharray="170 140"
            strokeLinecap="round"
            className="drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]"
          />
        </svg>

        {/* Central Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
            {amount}
          </span>
          <span className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase mt-0.5">
            UNPAID RATIO
          </span>
        </div>
      </div>

      {/* Footer Spark Indicators */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>LIVE AR STREAM</span>
        </div>
        <span className="text-cyan-300 font-bold">NET 15 AUTO</span>
      </div>
    </div>
  );
}
