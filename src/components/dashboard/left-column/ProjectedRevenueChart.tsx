'use client';

import React from 'react';

export function ProjectedRevenueChart() {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          PROJECTED vs ACTUAL REVENUE
        </h3>
        <span className="text-[10px] text-slate-400 font-mono">Last 30 days</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-[11px] font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 rounded-full bg-amber-500"></span>
          <span className="text-amber-400">Expenses</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 rounded-full bg-cyan-400"></span>
          <span className="text-cyan-400">Revenue</span>
        </div>
      </div>

      {/* SVG Multi-Line Chart */}
      <div className="h-40 w-full relative">
        <svg viewBox="0 0 300 120" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="20" x2="300" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="55" x2="300" y2="55" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="90" x2="300" y2="90" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />

          {/* Revenue Area & Line (Cyber-Cyan) */}
          <path
            d="M 0 95 Q 40 70, 75 80 T 150 45 T 225 35 T 300 15 L 300 120 L 0 120 Z"
            fill="url(#revenueGrad)"
          />
          <path
            d="M 0 95 Q 40 70, 75 80 T 150 45 T 225 35 T 300 15"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Expenses Area & Line (Copper-Orange) */}
          <path
            d="M 0 105 Q 45 95, 80 88 T 160 72 T 230 60 T 300 50 L 300 120 L 0 120 Z"
            fill="url(#expenseGrad)"
          />
          <path
            d="M 0 105 Q 45 95, 80 88 T 160 72 T 230 60 T 300 50"
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Summary Micro Metrics */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center font-mono">
        <div>
          <span className="text-[10px] text-slate-400 block">Total Rec:</span>
          <span className="text-xs font-bold text-cyan-400">$149,870</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Total Due:</span>
          <span className="text-xs font-bold text-amber-400">$22,410</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Avg. Collection</span>
          <span className="text-xs font-bold text-slate-200">18 days</span>
        </div>
      </div>
    </div>
  );
}
