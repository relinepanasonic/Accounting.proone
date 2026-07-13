'use client';

import React from 'react';

const invoices = [
  { id: 'INV-2026-001', client: 'Prof Toko Online', amount: 'Rp 149.870.000', dueDate: '15/07/26', status: 'Paid' },
  { id: 'INV-2026-002', client: 'Nüman Kitchenware', amount: 'Rp 22.410.000', dueDate: '18/07/26', status: 'Overdue' },
  { id: 'INV-2026-003', client: 'Bochtmon Studio', amount: 'Rp 85.400.000', dueDate: '20/07/26', status: 'Pending' },
  { id: 'INV-2026-004', client: 'Horrtnaes Corp', amount: 'Rp 25.800.000', dueDate: '22/07/26', status: 'Paid' },
  { id: 'INV-2026-005', client: 'Lereon Digital', amount: 'Rp 29.600.000', dueDate: '25/07/26', status: 'Paid' },
];

export function InvoicesDataTable() {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          RECENT CLIENT RECEIVABLES (IDR)
        </h3>
        <span className="inline-block w-10 h-1.5 rounded-full bg-gradient-to-r from-[#f5d77f] to-[#d4af37] shadow-[0_0_8px_#d4af37]"></span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans">
              <th className="py-2.5 px-2">Invoice Ref</th>
              <th className="py-2.5 px-2">Client Payee</th>
              <th className="py-2.5 px-2 text-right">Amount (Rp)</th>
              <th className="py-2.5 px-2 text-right">Due Date</th>
              <th className="py-2.5 px-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {invoices.map((inv, idx) => {
              const isPaid = inv.status === 'Paid';
              return (
                <tr
                  key={idx}
                  className="hover:bg-zinc-800/40 transition-colors group"
                >
                  <td className="py-2.5 px-2 text-[#f5d77f] font-bold">{inv.id}</td>
                  <td className="py-2.5 px-2 text-white font-sans font-medium">{inv.client}</td>
                  <td className="py-2.5 px-2 text-right text-[#f5d77f] font-extrabold">{inv.amount}</td>
                  <td className="py-2.5 px-2 text-right text-zinc-400">{inv.dueDate}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-[#d4af37]/30">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPaid
                            ? 'bg-[#f5d77f] shadow-[0_0_6px_#f5d77f]'
                            : 'bg-[#d4af37] shadow-[0_0_6px_#d4af37]'
                        }`}
                      />
                      <span className={isPaid ? 'text-[#f5d77f]' : 'text-[#d4af37]'}>
                        {inv.status}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
