'use client';

import React from 'react';
import { TrendingUp, ArrowUpRight } from 'lucide-react';

export function TopExecutiveStatsBar() {
  const stats = [
    {
      label: 'TOTAL SALES & REVENUE',
      value: 'Rp 1.450.800.000',
      change: '+18.4% vs last month',
      badge: '+18.4%',
      isPositive: true,
      curve: 'M 0 35 Q 25 20, 50 28 T 100 12 L 100 45 L 0 45 Z',
      line: 'M 0 35 Q 25 20, 50 28 T 100 12',
    },
    {
      label: 'TOTAL EXPENSES & OUTFLOW',
      value: 'Rp 482.500.000',
      change: '-4.2% operational savings',
      badge: '-4.2%',
      isPositive: true,
      curve: 'M 0 25 Q 30 35, 60 22 T 100 30 L 100 45 L 0 45 Z',
      line: 'M 0 25 Q 30 35, 60 22 T 100 30',
    },
    {
      label: 'NEW CLIENTS & CUSTOMERS',
      value: '3.482',
      change: '+114 active accounts',
      badge: '+14.8%',
      isPositive: true,
      curve: 'M 0 38 Q 20 28, 50 32 T 100 15 L 100 45 L 0 45 Z',
      line: 'M 0 38 Q 20 28, 50 32 T 100 15',
    },
    {
      label: 'AVG. INVOICE VALUE',
      value: 'Rp 25.400.000',
      change: '+Rp 2.100.000 order size',
      badge: '+9.6%',
      isPositive: true,
      curve: 'M 0 30 Q 30 15, 60 25 T 100 10 L 100 45 L 0 45 Z',
      line: 'M 0 30 Q 30 15, 60 25 T 100 10',
    },
  ];

  return (
    <div className="mb-8">
      {/* 4 Executive Number Cards with Mini Sparkline Charts (Pic 4 Style in Luxury Gold) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-2 z-10 relative">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                  {stat.label}
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight block drop-shadow-[0_0_10px_rgba(245,215,127,0.35)]">
                  {stat.value}
                </span>
              </div>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#d4af37]/15 text-[#f5d77f] border border-[#d4af37]/40 shrink-0">
                <ArrowUpRight className="w-3 h-3" />
                <span>{stat.badge}</span>
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between z-10 relative">
              <span className="text-[10px] font-mono text-zinc-400">
                {stat.change}
              </span>
            </div>

            {/* Mini Sparkline Chart Overlay inside Card */}
            <div className="absolute right-0 bottom-0 w-32 h-14 pointer-events-none opacity-80">
              <svg viewBox="0 0 100 45" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id={`topGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5d77f" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={stat.curve} fill={`url(#topGrad-${idx})`} />
                <path
                  d={stat.line}
                  fill="none"
                  stroke="#f5d77f"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
