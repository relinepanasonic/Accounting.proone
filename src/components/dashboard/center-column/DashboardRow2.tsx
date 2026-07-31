'use client';

import React from 'react';
import { DashboardTelemetry } from '@/lib/data/dashboard';

interface DashboardRow2Props {
  telemetry: DashboardTelemetry;
}

export function DashboardRow2({ telemetry }: DashboardRow2Props) {
  const { costs, bankBalance } = telemetry;

  // Chart Helpers
  const widthArea = 800;
  const heightArea = 220;
  const paddingY = 20;

  const generateAreaPath = (data: number[], minV: number, maxV: number) => {
    if (!data || data.length < 2) return `M 0 ${heightArea} L ${widthArea} ${heightArea}`;
    
    const range = (maxV - minV) || 1;
    const stepX = widthArea / (data.length - 1);
    const points = data.map((val, i) => ({
      x: i * stepX,
      y: heightArea - paddingY - ((val - minV) / range) * (heightArea - paddingY * 2)
    }));

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const pPrev = points[i - 1];
      const pCur = points[i];
      const cx = (pPrev.x + pCur.x) / 2;
      path += ` C ${cx} ${pPrev.y}, ${cx} ${pCur.y}, ${pCur.x} ${pCur.y}`;
    }
    return path;
  };

  const balanceMax = Math.max(...bankBalance.balance, 10000);
  const balanceMin = Math.min(...bankBalance.balance, 0); // floor at 0 for aesthetics
  const balanceCurve = generateAreaPath(bankBalance.balance, balanceMin, balanceMax);

  // Stacked Bar Helpers
  const barMax = Math.max(...costs.cogs.map((c, i) => c + costs.general[i]), 10000);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      
      {/* 1/3 Width: Cost vs COGS (Stacked Bar) */}
      <div className="lg:col-span-1 gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col min-h-[320px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white mb-1">
              Monthly Cost vs COGS
            </h3>
            <span className="text-xs font-mono text-zinc-400">Expense distribution</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-mono mb-4">
          <span className="inline-flex items-center gap-1.5 text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-zinc-600"></span>
            <span>Gen Costs</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#f5d77f]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#d4af37]"></span>
            <span>COGS</span>
          </span>
        </div>

        <div className="flex-1 w-full relative flex items-end justify-between px-2 pb-2 gap-2">
          {costs.months.map((m, i) => {
            const cogs = costs.cogs[i];
            const gen = costs.general[i];
            const total = cogs + gen;
            
            const totalPct = total > 0 ? (total / barMax) * 100 : 0;
            const cogsPct = total > 0 ? (cogs / total) * 100 : 0;
            const genPct = total > 0 ? (gen / total) * 100 : 0;

            return (
              <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                <div 
                  className="w-full max-w-[20px] sm:max-w-[30px] rounded-t-md flex flex-col justify-end overflow-hidden transition-all group-hover:opacity-80"
                  style={{ height: `${Math.max(totalPct, 1)}%` }}
                >
                  {/* General Cost (Top) */}
                  <div 
                    className="w-full bg-zinc-600 transition-all"
                    style={{ height: `${genPct}%` }}
                    title={`General: Rp ${gen.toLocaleString('id-ID')}`}
                  ></div>
                  {/* COGS (Bottom) */}
                  <div 
                    className="w-full bg-gradient-to-t from-[#d4af37] to-[#f5d77f] transition-all"
                    style={{ height: `${cogsPct}%` }}
                    title={`COGS: Rp ${cogs.toLocaleString('id-ID')}`}
                  ></div>
                </div>
                <span className="text-[9px] font-mono text-zinc-500 uppercase mt-3">{m}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2/3 Width: Monthly Bank Balance (Area Chart) */}
      <div className="lg:col-span-2 gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col min-h-[320px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white mb-1">
              Live Cash Balance Trend
            </h3>
            <span className="text-xs font-mono text-zinc-400">Net cash flow running total</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xl font-black font-mono text-[#f5d77f] drop-shadow-[0_0_8px_rgba(245,215,127,0.3)]">
              Rp {bankBalance.balance[bankBalance.balance.length - 1]?.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">Current Balance</span>
          </div>
        </div>

        <div className="flex-1 w-full relative pt-4">
          <svg viewBox={`0 0 ${widthArea} ${heightArea}`} className="w-full h-full overflow-visible preserve-3d" preserveAspectRatio="none">
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4af37" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#18233c" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Area Fill */}
            <path
              d={`${balanceCurve} L ${widthArea} ${heightArea} L 0 ${heightArea} Z`}
              fill="url(#balanceGrad)"
            />
            {/* Line */}
            <path
              d={balanceCurve}
              fill="none"
              stroke="#d4af37"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_rgba(212,175,55,0.4)]"
            />
          </svg>
        </div>

        {/* X-Axis Labels */}
        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase mt-4">
          {bankBalance.months.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      </div>

    </div>
  );
}
