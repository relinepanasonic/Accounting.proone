'use client';

import React from 'react';

export function CashFlowProfitCharts() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const profitMargins = [12, 14, 18, 15, 20, 22, 19, 24, 21, 25, 23, 26]; // percentages

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl space-y-5">
      {/* DAILY CASH FLOW AREA CHART */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            DAILY CASH FLOW
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">Sun - Sat</span>
        </div>
        <div className="h-20 w-full relative">
          <svg viewBox="0 0 300 80" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 50 Q 50 20, 100 45 T 200 15 T 300 35 L 300 80 L 0 80 Z"
              fill="url(#cfGrad)"
            />
            <path
              d="M 0 50 Q 50 20, 100 45 T 200 15 T 300 35"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* MONTHLY PROFIT MARGIN BAR CHART */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            MONTHLY PROFIT MARGIN
          </h4>
          <span className="text-[10px] text-cyan-400 font-mono">20% Avg</span>
        </div>
        <div className="flex items-end justify-between h-16 gap-1.5 pt-2">
          {profitMargins.map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm transition-all hover:brightness-125"
                style={{ height: `${(val / 30) * 100}%` }}
              />
              <span className="text-[9px] font-mono text-slate-400">{months[idx]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
