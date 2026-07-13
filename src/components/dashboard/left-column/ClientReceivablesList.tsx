'use client';

import React from 'react';

const clients = [
  { name: 'Prof Toko Online', count: 6, owed: '$149,870', status: 'cyan' },
  { name: 'Nüman Kitchenware', count: 20, owed: '$22,410', status: 'copper' },
  { name: 'Niko Elektronik', count: 5, owed: '$152,700', status: 'cyan' },
  { name: 'Competitors Rooro', count: 10, owed: '$149,800', status: 'cyan' },
  { name: 'Aleamsad Corp', count: 1, owed: '$85,400', status: 'cyan' },
  { name: 'Bochtmon Studio', count: 3, owed: '$85,400', status: 'copper' },
  { name: 'Pionie Media Group', count: 4, owed: '$85,200', status: 'cyan' },
  { name: 'Horrtnaes Co', count: 2, owed: '$83,400', status: 'copper' },
];

export function ClientReceivablesList() {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-xl flex-1 flex flex-col">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
        <span>Client Name</span>
        <div className="flex items-center gap-4">
          <span>Inv. Count</span>
          <span>Total Owed</span>
        </div>
      </div>

      <div className="space-y-2 mt-2 overflow-y-auto max-h-48 pr-1 font-mono text-xs">
        {clients.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-slate-200 truncate font-sans max-w-[130px]">
              {c.name}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 w-6 text-center">{c.count}</span>
              <span className="text-white font-semibold w-20 text-right">{c.owed}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  c.status === 'cyan'
                    ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
                    : 'bg-amber-500 shadow-[0_0_6px_#f97316]'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
