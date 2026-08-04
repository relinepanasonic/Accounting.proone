'use client';

import React from 'react';
import { TrendingUp, ArrowUpRight, Users, UserMinus, Receipt, Banknote, LineChart } from 'lucide-react';
import { DashboardTelemetry } from '@/lib/data/dashboard';

interface DashboardStatsCardsProps {
  telemetry: DashboardTelemetry;
}

export function DashboardStatsCards({ telemetry }: DashboardStatsCardsProps) {
  const { totalRevenue, totalSales, avgOrderValue, newCustomersCount, customerActiveCount } = telemetry;

  const stats = [
    {
      label: 'TOTAL REVENUE',
      value: `Rp ${totalRevenue.toLocaleString('en-US')}`,
      change: 'Issued invoices total',
      badge: 'Rev',
      icon: <Receipt className="w-4 h-4 text-[#d4af37]" />,
      curve: 'M 0 35 Q 25 20, 50 28 T 100 12 L 100 45 L 0 45 Z',
      line: 'M 0 35 Q 25 20, 50 28 T 100 12',
    },
    {
      label: 'TOTAL SALES',
      value: `Rp ${totalSales.toLocaleString('en-US')}`,
      change: 'Paid invoices total',
      badge: 'Sales',
      icon: <Banknote className="w-4 h-4 text-[#d4af37]" />,
      curve: 'M 0 25 Q 30 35, 60 22 T 100 30 L 100 45 L 0 45 Z',
      line: 'M 0 25 Q 30 35, 60 22 T 100 30',
    },
    {
      label: 'AVG. ORDER VALUE',
      value: `Rp ${Math.round(avgOrderValue).toLocaleString('en-US')}`,
      change: 'Mean paid invoice size',
      badge: 'Avg',
      icon: <LineChart className="w-4 h-4 text-[#d4af37]" />,
      curve: 'M 0 38 Q 20 28, 50 32 T 100 15 L 100 45 L 0 45 Z',
      line: 'M 0 38 Q 20 28, 50 32 T 100 15',
    },
    {
      label: 'NEW CUSTOMERS',
      value: `${newCustomersCount}`,
      change: 'Joined this month',
      badge: 'New',
      icon: <Users className="w-4 h-4 text-[#d4af37]" />,
      curve: 'M 0 30 Q 30 15, 60 25 T 100 10 L 100 45 L 0 45 Z',
      line: 'M 0 30 Q 30 15, 60 25 T 100 10',
    },
    {
      label: 'CUSTOMER ACTIVE',
      value: `${customerActiveCount || 0}`,
      change: 'Billed this month',
      badge: 'Active',
      icon: <Users className="w-4 h-4 text-[#d4af37]" />,
      curve: 'M 0 40 Q 25 45, 50 35 T 100 40 L 100 45 L 0 45 Z',
      line: 'M 0 40 Q 25 45, 50 35 T 100 40',
    },
  ];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between h-[120px]"
          >
            <div className="flex items-start justify-between gap-2 z-10 relative">
              <div className="w-full">
                <div className="flex items-center gap-2 mb-1">
                  {stat.icon}
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    {stat.label}
                  </span>
                </div>
                <span className="text-lg sm:text-xl font-black font-mono text-white tracking-tight block drop-shadow-[0_0_10px_rgba(245,215,127,0.35)] truncate">
                  {stat.value}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-end justify-between z-10 relative">
              <span className="text-[9px] font-mono text-zinc-400 opacity-80 truncate max-w-[70%]">
                {stat.change}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#d4af37]/15 text-[#f5d77f] border border-[#d4af37]/40 shrink-0">
                {stat.badge}
              </span>
            </div>

            {/* Mini Sparkline Chart Overlay inside Card */}
            <div className="absolute right-0 bottom-0 w-32 h-12 pointer-events-none opacity-60">
              <svg viewBox="0 0 100 45" className="w-full h-full overflow-visible preserve-3d">
                <defs>
                  <linearGradient id={`statGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5d77f" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={stat.curve}
                  fill={`url(#statGrad-${idx})`}
                />
                <path
                  d={stat.line}
                  fill="none"
                  stroke="#f5d77f"
                  strokeWidth="1.5"
                  className="drop-shadow-[0_0_4px_rgba(245,215,127,0.5)]"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
