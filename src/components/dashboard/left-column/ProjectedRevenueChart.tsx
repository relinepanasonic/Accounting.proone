'use client';

import React from 'react';

export function ProjectedRevenueChart() {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            PROJECTED REVENUE TREND
          </h3>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">Q3 2026 FORECAST (IDR)</p>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] bg-[#d4af37]/15 px-2.5 py-1 rounded-full border border-[#d4af37]/40">
          +24.8% YoY
        </span>
      </div>

      <div className="h-28 w-full relative pt-2">
        <svg viewBox="0 0 280 90" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="goldProjGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5d77f" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M 0 75 Q 70 45, 140 55 T 280 20 L 280 90 L 0 90 Z"
            fill="url(#goldProjGrad)"
          />
          <path
            d="M 0 75 Q 70 45, 140 55 T 280 20"
            fill="none"
            stroke="#f5d77f"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_rgba(245,215,127,0.5)]"
          />
          <circle cx="140" cy="55" r="4" fill="#09090b" stroke="#f5d77f" strokeWidth="2" />
          <circle cx="280" cy="20" r="4.5" fill="#f5d77f" stroke="#09090b" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-zinc-800">
        <span>JUL FORECAST: Rp 3,1 Miliar</span>
        <span className="text-[#f5d77f] font-bold">TARGET EXECUTIVE</span>
      </div>
    </div>
  );
}
