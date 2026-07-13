'use client';

import React from 'react';

export function ExpenseCategoryChart() {
  const categories = [
    { label: 'Software', value: 1050, color: 'from-cyan-500 to-cyan-300' },
    { label: 'Equipment', value: 780, color: 'from-cyan-600 to-cyan-400' },
    { label: 'Rent', value: 950, color: 'from-amber-600 to-amber-400' },
    { label: 'Misc', value: 420, color: 'from-cyan-500 to-cyan-300' },
    { label: 'Marketing', value: 340, color: 'from-amber-500 to-amber-300' },
    { label: 'Other', value: 280, color: 'from-cyan-600 to-cyan-400' },
  ];

  const maxVal = 1200;

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          EXPENSE CATEGORY BREAKDOWN
        </h3>
        <span className="text-[10px] font-mono text-slate-400">Max $1,200</span>
      </div>

      <div className="flex items-end justify-between h-28 gap-3 pt-3">
        {categories.map((cat, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`w-full bg-gradient-to-t ${cat.color} rounded-t-sm transition-all hover:brightness-125 shadow-lg`}
              style={{ height: `${(cat.value / maxVal) * 100}%` }}
            />
            <span className="text-[9px] font-mono text-slate-400 truncate max-w-[48px]">
              {cat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
