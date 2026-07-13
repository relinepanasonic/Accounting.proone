'use client';

import React from 'react';

export function CollectionHealthCompass() {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            HEALTH SCORE COMPASS
          </h3>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">COLLECTION VELOCITY</p>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] font-extrabold">
          94.2 / 100
        </span>
      </div>

      <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#18181b"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#d4af37"
            strokeWidth="8"
            strokeDasharray="251.2"
            strokeDashoffset="18"
            strokeLinecap="round"
            className="drop-shadow-[0_0_12px_rgba(212,175,55,0.6)]"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black text-white">94%</span>
          <span className="text-[9px] font-mono text-[#f5d77f] uppercase tracking-widest mt-0.5">
            HEALTHY
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-zinc-800">
        <span>AVG DSO: 14 DAYS</span>
        <span className="text-[#f5d77f] font-bold">OPTIMAL</span>
      </div>
    </div>
  );
}
