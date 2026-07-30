'use client';

import React from 'react';

interface CollectionHealthCompassProps {
  score?: number;
}

export function CollectionHealthCompass({ score = 100 }: CollectionHealthCompassProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // approx 251.2
  // score is 0-100, we want strokeDashoffset to be circumference * (1 - score/100)
  const offset = circumference * (1 - score / 100);
  
  let label = 'HEALTHY';
  let color = '#f5d77f';
  if (score < 50) { label = 'CRITICAL'; color = '#ef4444'; }
  else if (score < 80) { label = 'WARNING'; color = '#f97316'; }

  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            HEALTH SCORE COMPASS
          </h3>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">COLLECTION VELOCITY</p>
        </div>
        <span className="text-[10px] font-mono font-extrabold" style={{ color }}>
          {score.toFixed(1)} / 100
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
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
            className={score >= 80 ? "drop-shadow-[0_0_12px_rgba(212,175,55,0.6)]" : ""}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black text-white">{Math.round(score)}%</span>
          <span className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color }}>
            {label}
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
