'use client';

import React from 'react';

const bills = [
  { vendor: 'Due Bills Name', amount: '$80,300', dueDate: '07/07/23' },
  { vendor: 'Competitors Rooro', amount: '$50,300', dueDate: '07/05/23' },
  { vendor: 'Billt Customers', amount: '$25,700', dueDate: '07/07/23' },
  { vendor: 'Bills Software', amount: '$35,800', dueDate: '07/07/23' },
  { vendor: 'Doc Software', amount: '$15,800', dueDate: '07/10/21' },
  { vendor: 'Comprantiors Store', amount: '$30,400', dueDate: '07/10/21' },
  { vendor: 'Doc Sol & Inlive', amount: '$15,300', dueDate: '07/14/21' },
];

export function UpcomingBillsList() {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          UPCOMING BILLS (A/P)
        </h3>
        <span className="text-[10px] font-mono text-amber-400">Due Bills</span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 pb-1.5 border-b border-slate-800">
        <span>Vendor</span>
        <div className="flex items-center gap-6">
          <span>Amount</span>
          <span>Due Date</span>
        </div>
      </div>

      <div className="space-y-1.5 mt-2 overflow-y-auto max-h-44 pr-1 font-mono text-xs">
        {bills.map((b, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-slate-300 font-sans truncate max-w-[140px]">
              {b.vendor}
            </span>
            <div className="flex items-center gap-6">
              <span className="text-amber-400 font-semibold w-16 text-right">
                {b.amount}
              </span>
              <span className="text-slate-400 w-16 text-right">{b.dueDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
