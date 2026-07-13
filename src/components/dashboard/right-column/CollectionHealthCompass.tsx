'use client';

import React from 'react';

export function CollectionHealthCompass() {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden flex flex-col items-center justify-center">
      <div className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
        <span>PAYMENT COLLECTION HEALTH SCORE</span>
        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]"></span>
      </div>

      {/* Extremely Complex HUD Compass Visual */}
      <div className="relative w-56 h-56 flex items-center justify-center my-2">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Outer Compass Rings */}
          <circle cx="100" cy="100" r="92" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="100" cy="100" r="68" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.35" />
          <circle cx="100" cy="100" r="54" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="140 40" />

          {/* Compass Points N, S, E, W */}
          <text x="96" y="22" fill="#94a3b8" fontSize="9" fontWeight="bold" fontFamily="monospace">N</text>
          <text x="96" y="186" fill="#94a3b8" fontSize="9" fontWeight="bold" fontFamily="monospace">S</text>
          <text x="180" y="103" fill="#94a3b8" fontSize="9" fontWeight="bold" fontFamily="monospace">E</text>
          <text x="14" y="103" fill="#94a3b8" fontSize="9" fontWeight="bold" fontFamily="monospace">W</text>

          {/* Radar Tick Lines */}
          <line x1="100" y1="10" x2="100" y2="28" stroke="#06b6d4" strokeWidth="1" />
          <line x1="100" y1="172" x2="100" y2="190" stroke="#f97316" strokeWidth="1" />
          <line x1="10" y1="100" x2="28" y2="100" stroke="#06b6d4" strokeWidth="1" />
          <line x1="172" y1="100" x2="190" y2="100" stroke="#06b6d4" strokeWidth="1" />
        </svg>

        {/* Central Core Text '4z' */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]">
            4z
          </span>
          <span className="text-[9px] uppercase tracking-widest text-cyan-400 font-bold mt-0.5">
            Health Index
          </span>
        </div>

        {/* Diagonal Micro Labels */}
        <span className="absolute top-2 left-1 text-[9px] font-mono text-cyan-300 transform -rotate-45">
          Collection Velocity
        </span>
        <span className="absolute top-2 right-1 text-[9px] font-mono text-amber-300 transform rotate-45">
          Invoicing Frequency
        </span>
        <span className="absolute bottom-2 left-2 text-[9px] font-mono text-amber-400">
          Net-30 Score
        </span>
        <span className="absolute bottom-2 right-2 text-[9px] font-mono text-cyan-400">
          Optimal
        </span>
      </div>
    </div>
  );
}
