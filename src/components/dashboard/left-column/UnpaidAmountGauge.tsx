'use client';

import React from 'react';

export function UnpaidAmountGauge() {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col items-center justify-between">
      <div className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
        <span>UNPAID INVOICES</span>
        <span className="text-[10px] text-amber-400 font-mono">Days Overdue: 4</span>
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
            810
          </span>
          <span className="text-xs font-semibold text-cyan-400">%</span>
        </div>
      </div>

      {/* Bottom Sub-label */}
      <div className="w-full flex items-center justify-between text-xs font-mono text-slate-300 pt-2 border-t border-slate-800/80">
        <span className="text-slate-400">Target Rec: 4</span>
        <span className="text-cyan-400 font-bold">Active Receivables: $15,000</span>
      </div>
    </div>
  );
}
