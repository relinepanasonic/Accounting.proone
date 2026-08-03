'use client';

import React from 'react';

interface ProjectedRevenueChartProps {
  projectedAmount: number;
  targetAmount: number;
  percentChange: number;
  historicalData: number[]; // e.g. [1200000, 1500000, 1800000, 1300000, projectedAmount]
}

export function ProjectedRevenueChart({
  projectedAmount = 0,
  targetAmount = 0,
  percentChange = 0,
  historicalData = []
}: ProjectedRevenueChartProps) {
  // SVG Dimensions
  const width = 280;
  const height = 90;
  const paddingY = 15;

  // Generate dynamic SVG path
  let pathStr = '';
  let lastX = 0;
  let lastY = height;

  if (historicalData.length > 1) {
    const minVal = Math.min(...historicalData, 0); // floor at 0 for visual stability
    const maxVal = Math.max(...historicalData, targetAmount, 1000000);
    const range = maxVal - minVal;

    const stepX = width / (historicalData.length - 1);
    
    // Create smoothed curve using Q/T commands
    const points = historicalData.map((val, i) => {
      const x = i * stepX;
      // y is inverted (0 is top)
      const y = height - paddingY - ((val - minVal) / range) * (height - paddingY * 2);
      return { x, y };
    });

    pathStr = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const pPrev = points[i - 1];
      const pCur = points[i];
      // Simple cubic approximation via quadratic curves
      const cx = (pPrev.x + pCur.x) / 2;
      const cy = (pPrev.y + pCur.y) / 2;
      if (i === 1) {
        pathStr += ` Q ${pPrev.x} ${pPrev.y}, ${cx} ${cy} T ${pCur.x} ${pCur.y}`;
      } else {
        pathStr += ` T ${pCur.x} ${pCur.y}`;
      }
    }
    
    lastX = points[points.length - 1].x;
    lastY = points[points.length - 1].y;
  } else {
    pathStr = 'M 0 75 L 280 75';
    lastX = 280;
    lastY = 75;
  }

  const isPositive = percentChange >= 0;

  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            PROJECTED REVENUE TREND
          </h3>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">CURRENT MONTH FORECAST (IDR)</p>
        </div>
        <span className={`text-[10px] font-mono ${isPositive ? 'text-[#f5d77f] bg-[#d4af37]/15 border-[#d4af37]/40' : 'text-red-400 bg-red-500/10 border-red-500/30'} px-2.5 py-1 rounded-full border`}>
          {isPositive ? '+' : ''}{percentChange.toFixed(1)}% MoM
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
            d={`${pathStr} L 280 90 L 0 90 Z`}
            fill="url(#goldProjGrad)"
          />
          <path
            d={pathStr}
            fill="none"
            stroke="#f5d77f"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_rgba(245,215,127,0.5)]"
          />
          <circle cx={lastX} cy={lastY} r="4.5" fill="#f5d77f" stroke="#09090b" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-zinc-800">
        <span>FORECAST: Rp {(projectedAmount / 1000000).toLocaleString('en-US', {maximumFractionDigits:1})} M</span>
        <span className="text-[#f5d77f] font-bold">TARGET: Rp {(targetAmount / 1000000).toLocaleString('en-US', {maximumFractionDigits:1})} M</span>
      </div>
    </div>
  );
}
