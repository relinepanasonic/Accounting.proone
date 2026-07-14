'use client';

import React from 'react';
import Link from 'next/link';

interface InvoiceItem {
  id: string;
  client: string;
  amount: string;
  dueDate: string;
  status: string;
}

interface InvoicesDataTableProps {
  invoicesList?: InvoiceItem[];
}

export function InvoicesDataTable({ invoicesList = [] }: InvoicesDataTableProps) {
  return (
    <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-5 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          RECENT CLIENT RECEIVABLES (IDR)
        </h3>
        <span className="inline-block w-10 h-1.5 rounded-full bg-gradient-to-r from-[#f5d77f] to-[#d4af37] shadow-[0_0_8px_#d4af37]"></span>
      </div>

      {invoicesList.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-zinc-800/80 rounded-xl my-4 space-y-3">
          <p className="text-xs text-zinc-400 font-sans">No receivables or issued invoices recorded yet.</p>
          <Link
            href="/invoices/new"
            className="gold-btn inline-block px-5 py-2 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-transform hover:scale-105"
          >
            + CREATE FIRST INVOICE
          </Link>
        </div>
      ) : (
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
              {invoicesList.map((inv, idx) => {
                const isPaid = inv.status.toLowerCase() === 'paid';
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
      )}
    </div>
  );
}
