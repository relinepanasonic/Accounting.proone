'use client';

import React from 'react';
import Link from 'next/link';

interface BillItem {
  vendor: string;
  dueDate: string;
  amount: string;
}

interface UpcomingBillsListProps {
  upcomingBills?: BillItem[];
}

export function UpcomingBillsList({ upcomingBills = [] }: UpcomingBillsListProps) {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          UPCOMING BILLS & A/P (IDR)
        </h3>
        <span className="text-[10px] font-mono text-[#f5d77f]">MONEY OUT</span>
      </div>

      {upcomingBills.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-zinc-800/80 rounded-xl space-y-2">
          <p className="text-zinc-500 text-[11px] font-mono">No upcoming bills or payables.</p>
          <Link
            href="/expenses/new"
            className="text-[#f5d77f] hover:underline text-[11px] font-bold block"
          >
            + Record Expense / Payable
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {upcomingBills.map((b, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-[#d4af37]/40 transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-white">{b.vendor}</div>
                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  Due: <span className="text-[#f5d77f] font-bold">{b.dueDate}</span>
                </div>
              </div>

              <span className="text-xs font-extrabold font-mono text-[#f5d77f]">
                {b.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
