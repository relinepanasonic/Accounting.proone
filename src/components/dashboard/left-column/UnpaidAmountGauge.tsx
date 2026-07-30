'use client';

import React from 'react';

interface UnpaidAmountGaugeProps {
  amount?: number;
  totalVolume?: number;
  overdueCount?: number;
}

export function UnpaidAmountGauge({ amount = 0, totalVolume = 1, overdueCount = 0 }: UnpaidAmountGaugeProps) {
  const percentage = totalVolume > 0 ? (amount / totalVolume) : 0;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  // Maximum length of arc we want to fill is maybe 80% of circumference?
  // Let's use 210 for the background dash (210 filled, 100 empty) which is roughly ~67% of circle.
  // Wait, circumference = 2 * 3.1415 * 48 = 301.59
  // 210 is about 70% of the circle.
  const arcLength = 210;
  
  const filledLength = Math.max(0, Math.min(percentage * arcLength, arcLength));
  const emptyLength = 310 - filledLength; // 310 is slightly more than circumference to ensure it wraps correctly

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  
  // Format the main large number text compactly
  const formatCompact = (val: number) => {
    if (val >= 1000000000) return `${(val / 1000000000).toFixed(1).replace('.', ',')} M`;
    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.', ',')} Jt`;
    return `${(val / 1000).toFixed(0)} Rb`;
  };
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 flex flex-col items-center justify-between">
      <div className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-200 mb-2">
        <span>UNPAID INVOICES (IDR)</span>
        <span className="text-[10px] text-[#f5d77f] font-mono">Days Overdue: {overdueCount}</span>
      </div>

      {/* Glowing Luxury Gold Circular Arc Gauge */}
      <div className="relative w-44 h-44 flex items-center justify-center my-2">
        <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#18181b"
            strokeWidth="9"
            strokeDasharray="210 100"
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#d4af37"
            strokeWidth="9"
            strokeDasharray={`${filledLength} ${emptyLength}`}
            strokeLinecap="round"
            className="drop-shadow-[0_0_15px_rgba(212,175,55,0.65)]"
            style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
          />
        </svg>

        {/* Central Gold Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_12px_rgba(245,215,127,0.45)]">
            {formatCompact(amount)}
          </span>
          <span className="text-[10px] font-mono text-[#f5d77f] tracking-widest uppercase mt-1">
            TOTAL OVERDUE
          </span>
        </div>
      </div>

      {/* Footer Gold Spark Indicators */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-[#d4af37]/20">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
          <span>{overdueCount} Client Invoices</span>
        </div>
        <span className="text-[#f5d77f] font-bold">{formatCurrency(amount)}</span>
      </div>
    </div>
  );
}
