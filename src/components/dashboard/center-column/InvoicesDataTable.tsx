'use client';

import React from 'react';

const invoices = [
  { id: 'Invoice1', client: 'Aleamsad', amount: '$149,070', dueDate: '01/10/21', status: 'Paid' },
  { id: 'Invoice2', client: 'Bochtmon', amount: '$23,400', dueDate: '01/10/21', status: 'Overdue' },
  { id: 'Invoice3', client: 'Pionie', amount: '$13,800', dueDate: '01/10/21', status: 'Overdue' },
  { id: 'Invoice4', client: 'Horrtnaes', amount: '$25,800', dueDate: '01/10/21', status: 'Paid' },
  { id: 'Invoice5', client: 'Lereon', amount: '$29,600', dueDate: '01/10/21', status: 'Paid' },
  { id: 'Invoice6', client: 'Recolnans', amount: '$23,600', dueDate: '01/10/21', status: 'Paid' },
  { id: 'Invoice7', client: 'Rovisnvad', amount: '$6,800', dueDate: '01/10/21', status: 'Overdue' },
];

export function InvoicesDataTable() {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          INVOICES
        </h3>
        <span className="inline-block w-10 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_#22d3ee]"></span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-sans">
              <th className="py-2 px-2">Invoice ID</th>
              <th className="py-2 px-2">Client</th>
              <th className="py-2 px-2 text-right">Amount</th>
              <th className="py-2 px-2 text-right">Due Date</th>
              <th className="py-2 px-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {invoices.map((inv, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-800/40 transition-colors group"
              >
                <td className="py-2 px-2 text-slate-300 font-semibold">{inv.id}</td>
                <td className="py-2 px-2 text-white font-sans">{inv.client}</td>
                <td className="py-2 px-2 text-right text-slate-200 font-bold">{inv.amount}</td>
                <td className="py-2 px-2 text-right text-slate-400">{inv.dueDate}</td>
                <td className="py-2 px-2 text-center">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        inv.status === 'Paid'
                          ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
                          : 'bg-amber-500 shadow-[0_0_6px_#f97316]'
                      }`}
                    />
                    <span
                      className={
                        inv.status === 'Paid' ? 'text-cyan-400' : 'text-amber-400'
                      }
                    >
                      {inv.status}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
