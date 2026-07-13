'use client';

import React from 'react';

const BILLS = [
  { payee: 'Cloud Server Hosting A/P', due: '15 Jul', amount: 'Rp 18.000.000' },
  { payee: 'Studio Rent & Power', due: '18 Jul', amount: 'Rp 64.500.000' },
  { payee: 'Affiliator Creator Payouts', due: '20 Jul', amount: 'Rp 127.500.000' },
];

export function UpcomingBillsList() {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          UPCOMING BILLS & A/P (IDR)
        </h3>
        <span className="text-[10px] font-mono text-[#f5d77f]">MONEY OUT</span>
      </div>

      <div className="space-y-2.5">
        {BILLS.map((b, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-[#d4af37]/40 transition-colors"
          >
            <div>
              <div className="text-xs font-bold text-white">{b.payee}</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                Due: <span className="text-[#f5d77f] font-bold">{b.due}</span>
              </div>
            </div>

            <span className="text-xs font-extrabold font-mono text-[#f5d77f]">
              {b.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
