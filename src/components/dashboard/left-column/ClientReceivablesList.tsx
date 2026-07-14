'use client';

import React from 'react';

interface ClientItem {
  name: string;
  count: number;
  owed: string;
  status: 'cyan' | 'copper';
}

interface ClientReceivablesListProps {
  clientReceivables?: ClientItem[];
}

export function ClientReceivablesList({ clientReceivables = [] }: ClientReceivablesListProps) {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          CLIENT RECEIVABLES LIST
        </h3>
        <span className="text-[10px] font-mono text-[#f5d77f]">IDR LIVE</span>
      </div>

      {clientReceivables.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-zinc-800/80 rounded-xl text-zinc-500 text-[11px] font-mono">
          No client accounts with active balances.
        </div>
      ) : (
        <div className="space-y-2.5">
          {clientReceivables.map((c, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-[#d4af37]/40 transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-white">{c.name}</div>
                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  Bills: <span className="text-[#f5d77f]">{c.count} active</span>
                </div>
              </div>

              <span className="text-xs font-extrabold font-mono text-[#f5d77f] drop-shadow-[0_0_8px_rgba(245,215,127,0.35)]">
                {c.owed}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
