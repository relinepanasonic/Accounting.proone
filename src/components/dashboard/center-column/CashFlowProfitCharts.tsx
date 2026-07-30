'use client';

import React from 'react';

interface CashFlowProfitChartsProps {
  months: string[];
  revenue: number[];
  expenses: number[];
  depreciation: number[];
}

export function CashFlowProfitCharts({
  months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  revenue = [0, 0, 0, 0, 0, 0, 0, 0, 0],
  expenses = [0, 0, 0, 0, 0, 0, 0, 0, 0],
  depreciation = [0, 0, 0, 0, 0, 0, 0, 0, 0]
}: CashFlowProfitChartsProps) {
  
  // Helpers to generate SVG curves
  const width = 300;
  const height = 80;
  const paddingY = 10;
  
  const generatePath = (data: number[], minV: number, maxV: number) => {
    if (data.length < 2) return `M 0 ${height} L ${width} ${height}`;
    
    const range = (maxV - minV) || 1;
    const stepX = width / (data.length - 1);
    const points = data.map((val, i) => ({
      x: i * stepX,
      y: height - paddingY - ((val - minV) / range) * (height - paddingY * 2)
    }));

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const pPrev = points[i - 1];
      const pCur = points[i];
      const cx = (pPrev.x + pCur.x) / 2;
      const cy = (pPrev.y + pCur.y) / 2;
      if (i === 1) {
        path += ` Q ${pPrev.x} ${pPrev.y}, ${cx} ${cy} T ${pCur.x} ${pCur.y}`;
      } else {
        path += ` T ${pCur.x} ${pCur.y}`;
      }
    }
    return path;
  };

  const combinedMax = Math.max(...revenue, ...expenses, 10000);
  const combinedMin = Math.min(...revenue, ...expenses, 0);

  const revenueCurve = generatePath(revenue, combinedMin, combinedMax);
  const expensesCurve = generatePath(expenses, combinedMin, combinedMax);

  const maxDep = Math.max(...depreciation, 100);
  
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 space-y-6">
      {/* REVENUE VS EXPENSES GOLD AREA CHART */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              REVENUE VS EXPENSES
            </h4>
            <span className="text-[10px] text-zinc-400 font-mono">2026 Executive Performance</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="inline-flex items-center gap-1.5 text-[#f5d77f]">
              <span className="w-2.5 h-0.5 bg-[#f5d77f]"></span>
              <span>Revenue</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-0.5 bg-zinc-500"></span>
              <span>Expenses</span>
            </span>
          </div>
        </div>

        <div className="h-32 w-full relative pt-2">
          <svg viewBox="0 0 300 80" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="goldRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5d77f" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Revenue Gold Gradient Fill */}
            <path
              d={`${revenueCurve} L 300 80 L 0 80 Z`}
              fill="url(#goldRevGrad)"
            />
            {/* Revenue Gold Line */}
            <path
              d={revenueCurve}
              fill="none"
              stroke="#f5d77f"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_rgba(245,215,127,0.6)]"
            />
            {/* Expenses Muted Gold Line */}
            <path
              d={expensesCurve}
              fill="none"
              stroke="#997319"
              strokeWidth="1.8"
              strokeDasharray="4 2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* ASSET DEPRECIATION GOLD BAR CHART */}
      <div className="pt-4 border-t border-[#d4af37]/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            ASSET DEPRECIATION SCHEDULE
          </h4>
          <span className="text-[10px] text-[#d4af37] font-mono">Straight-Line Recovery</span>
        </div>
        <div className="flex items-end justify-between h-20 gap-2 pt-2">
          {depreciation.map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div
                className="w-full bg-gradient-to-t from-[#997319] via-[#d4af37] to-[#f5d77f] rounded-t-sm transition-all group-hover:brightness-125 shadow-[0_0_8px_rgba(212,175,55,0.2)]"
                style={{ height: `${Math.max(2, (val / maxDep) * 100)}%` }}
              />
              <span className="text-[9px] font-mono text-zinc-400 group-hover:text-[#f5d77f]">
                {months[idx]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
