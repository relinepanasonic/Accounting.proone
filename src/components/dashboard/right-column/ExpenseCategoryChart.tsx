'use client';

import React from 'react';

const CATEGORIES = [
  { label: 'Computing & Servers', pct: 42, color: '#f5d77f' },
  { label: 'Creator Payouts', pct: 31, color: '#d4af37' },
  { label: 'Studio & Power', pct: 18, color: '#aa820a' },
  { label: 'Software Licenses', pct: 9, color: '#735706' },
];

export function ExpenseCategoryChart() {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          EXPENSE CATEGORY BREAKDOWN
        </h3>
        <span className="text-[10px] font-mono text-[#f5d77f]">OUTFLOWS</span>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-sans">{item.label}</span>
              <span className="font-mono font-bold text-[#f5d77f]">{item.pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${item.pct}%`,
                  backgroundColor: item.color,
                  boxShadow: `0 0 8px ${item.color}`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
