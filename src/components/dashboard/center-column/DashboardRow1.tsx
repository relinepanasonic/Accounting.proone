'use client';

import React from 'react';
import { DashboardTelemetry } from '@/lib/data/dashboard';
import { Package } from 'lucide-react';

interface DashboardRow1Props {
  telemetry: DashboardTelemetry;
}

export function DashboardRow1({ telemetry }: DashboardRow1Props) {
  const { salesVsPaid, topProducts } = telemetry;
  const { months, issued, paid } = salesVsPaid;

  const [hoverState, setHoverState] = React.useState<{ idx: number, x: number, y: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find closest index
    const stepX = rect.width / (months.length - 1);
    let closestIdx = Math.round(x / stepX);
    if (closestIdx < 0) closestIdx = 0;
    if (closestIdx >= months.length) closestIdx = months.length - 1;
    
    setHoverState({ idx: closestIdx, x, y });
  };

  const handleMouseLeave = () => {
    setHoverState(null);
  };

  // Chart Helpers
  const width = 800;
  const height = 220;
  const paddingY = 20;

  const generatePath = (data: number[], minV: number, maxV: number) => {
    if (!data || data.length < 2) return `M 0 ${height} L ${width} ${height}`;
    
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
      path += ` C ${cx} ${pPrev.y}, ${cx} ${pCur.y}, ${pCur.x} ${pCur.y}`;
    }
    return path;
  };

  const combinedMax = Math.max(...issued, ...paid, 10000);
  const combinedMin = Math.min(...issued, ...paid, 0);

  const issuedCurve = generatePath(issued, combinedMin, combinedMax);
  const paidCurve = generatePath(paid, combinedMin, combinedMax);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      
      {/* 2/3 Width: Sales vs Paid Chart */}
      <div className="lg:col-span-2 gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col justify-between min-h-[320px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white mb-1">
              Monthly Sales vs Paid
            </h3>
            <span className="text-xs font-mono text-zinc-400">Invoice volume conversion trend</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="inline-flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-0.5 bg-zinc-500"></span>
              <span>Issued Invoices</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#f5d77f]">
              <span className="w-2.5 h-0.5 bg-[#f5d77f]"></span>
              <span>Paid Collections</span>
            </span>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 w-full relative pt-4 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible preserve-3d" preserveAspectRatio="none">
            <defs>
              <linearGradient id="paidGoldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5d77f" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Guide line when hovered */}
            {hoverState && (
              <line 
                x1={hoverState.idx * (width / (months.length - 1))} 
                y1={0} 
                x2={hoverState.idx * (width / (months.length - 1))} 
                y2={height} 
                stroke="#d4af37" 
                strokeWidth="1" 
                strokeDasharray="4 4" 
                opacity="0.5" 
              />
            )}

            {/* Paid Gold Gradient Fill */}
            <path
              d={`${paidCurve} L ${width} ${height} L 0 ${height} Z`}
              fill="url(#paidGoldGrad)"
            />
            {/* Issued Muted Line */}
            <path
              d={issuedCurve}
              fill="none"
              stroke="#666"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
            {/* Paid Gold Line */}
            <path
              d={paidCurve}
              fill="none"
              stroke="#f5d77f"
              strokeWidth="3"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_rgba(245,215,127,0.7)]"
            />
          </svg>

          {/* Hover Tooltip */}
          {hoverState && (
            <div 
              className="absolute pointer-events-none z-10 p-3 rounded-lg bg-[#0f1525]/90 backdrop-blur-sm border border-[#d4af37]/30 shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col gap-1 min-w-[150px] -translate-x-1/2 -translate-y-full transition-all duration-75"
              style={{
                left: hoverState.x,
                top: hoverState.y - 15,
              }}
            >
              <div className="text-[10px] font-bold text-white uppercase mb-1 border-b border-zinc-800 pb-1">
                {months[hoverState.idx]}
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-zinc-400">Issued</span>
                <span className="text-zinc-300 font-bold">Rp {issued[hoverState.idx].toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[#f5d77f]">Paid</span>
                <span className="text-[#f5d77f] font-bold drop-shadow-[0_0_5px_rgba(245,215,127,0.5)]">
                  Rp {paid[hoverState.idx].toLocaleString('en-US')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* X-Axis Labels */}
        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase mt-4">
          {months.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      </div>

      {/* 1/3 Width: Top 5 Products */}
      <div className="lg:col-span-1 gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-6">
          <Package className="w-4 h-4 text-[#d4af37]" />
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">
            Top 10 Products by Sales
          </h3>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          {topProducts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs font-mono text-zinc-500">
              No product sales data
            </div>
          ) : (
            topProducts.map((p, i) => {
              const maxAmt = topProducts[0].amount || 1;
              const percent = Math.max(2, (p.amount / maxAmt) * 100);
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-[#d4af37] font-black font-mono text-lg opacity-50">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-xs font-bold text-white truncate max-w-[60%]">
                        {p.name}
                      </span>
                      <span className="text-[10px] font-mono text-[#f5d77f]">
                        Rp {p.amount.toLocaleString('en-US')}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-[#18233c] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#d4af37] to-[#f5d77f] rounded-full transition-all duration-1000"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
