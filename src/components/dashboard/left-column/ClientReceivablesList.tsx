'use client';

import React from 'react';

const CLIENTS = [
  { name: 'Prof Toko Online', amount: 'Rp 149.870.000', status: 'PAID', isPaid: true },
  { name: 'Nüman Kitchenware', amount: 'Rp 22.410.000', status: 'OVERDUE', isPaid: false },
  { name: 'Bochtmon Studio', amount: 'Rp 85.400.000', status: 'PENDING', isPaid: false },
];

export function ClientReceivablesList() {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          CLIENT RECEIVABLES LIST
        </h3>
        <span className="text-[10px] font-mono text-[#f5d77f]">IDR LIVE</span>
      </div>

      <div className="space-y-2.5">
        {CLIENTS.map((c, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-[#d4af37]/40 transition-colors"
          >
            <div>
              <div className="text-xs font-bold text-white">{c.name}</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                Status: <span className={c.isPaid ? 'text-[#f5d77f]' : 'text-[#d4af37]'}>{c.status}</span>
              </div>
            </div>

            <span className="text-xs font-extrabold font-mono text-[#f5d77f] drop-shadow-[0_0_8px_rgba(245,215,127,0.35)]">
              {c.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
