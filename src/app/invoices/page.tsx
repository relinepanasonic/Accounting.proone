import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { InvoiceRowActions } from '@/components/invoices/InvoiceRowActions';

export const dynamic = 'force-dynamic';

async function InvoicesTableServer() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total_amount, due_date, client_id, clients(name)')
    .order('created_at', { ascending: false });

  const displayInvoices =
    invoices && invoices.length > 0
      ? invoices.map((inv) => {
          const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
          return {
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            clientName: clientObj?.name || 'Client',
            amount: `$${Number(inv.total_amount || 0).toLocaleString()}`,
            dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '07/16/2026',
            status: inv.status || 'draft',
          };
        })
      : [
          { id: '33333333-3333-3333-3333-333333333301', invoiceNumber: 'INV-2026-001', clientName: 'Prof Toko Online', amount: '$149,870', dueDate: '07/16/2026', status: 'paid' },
          { id: '33333333-3333-3333-3333-333333333302', invoiceNumber: 'INV-2026-002', clientName: 'Nüman Kitchenware', amount: '$22,410', dueDate: '07/18/2026', status: 'overdue' },
          { id: '33333333-3333-3333-3333-333333333303', invoiceNumber: 'INV-2026-003', clientName: 'Bochtmon Studio', amount: '$85,400', dueDate: '07/20/2026', status: 'draft' },
        ];

  return (
    <div className="gold-glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            CLIENT RECEIVABLES & ISSUED BILLS REGISTRY
          </h2>
          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
            LUXURY GOLD TELEMETRY • INSTANT STATUS SWITCH & DRAFT COPY
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] bg-[#d4af37]/15 px-3 py-1 rounded-full border border-[#d4af37]/40">
          INCOME RECEIVABLE MATRIX
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans">
              <th className="py-3 px-3">Invoice ID</th>
              <th className="py-3 px-3">Client Payee</th>
              <th className="py-3 px-3">Due Date</th>
              <th className="py-3 px-3 text-right">Amount Billed</th>
              <th className="py-3 px-3 text-center">Status Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {displayInvoices.map((inv) => (
              <tr
                key={inv.id}
                className="hover:bg-zinc-800/30 transition-colors group"
              >
                <td className="py-3 px-3 font-bold text-[#f5d77f]">
                  {inv.invoiceNumber}
                </td>
                <td className="py-3 px-3 font-sans font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                  {inv.clientName}
                </td>
                <td className="py-3 px-3 text-zinc-400">
                  {inv.dueDate}
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="text-sm font-extrabold text-[#f5d77f] drop-shadow-[0_0_10px_rgba(245,215,127,0.35)]">
                    {inv.amount}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <InvoiceRowActions id={inv.id} status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <span>INVOICES • CLIENT INCOME & RECEIVABLES REGISTRY</span>
          </h1>
          <p className="text-xs text-[#d4af37] font-mono">
            LUXURY EXECUTIVE HUD • ZERO WATERFALL DATA PROTOCOL
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>NEW INVOICE</span>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="gold-glass-panel rounded-2xl h-80 animate-pulse p-6"></div>
        }
      >
        <InvoicesTableServer />
      </Suspense>
    </div>
  );
}
