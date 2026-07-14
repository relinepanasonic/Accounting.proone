import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { InvoiceRowActions } from '@/components/invoices/InvoiceRowActions';

export const dynamic = 'force-dynamic';

async function InvoicesTableServer() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total_amount, due_date, client_id, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .order('created_at', { ascending: false });

  const displayInvoices =
    invoices && invoices.length > 0
      ? invoices.map((inv) => {
          const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
          return {
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            clientName: clientObj?.name || 'Client',
            amount: `Rp ${Number(inv.total_amount || 0).toLocaleString('id-ID')}`,
            dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '16/07/2026',
            status: inv.status || 'draft',
          };
        })
      : [];

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

      {displayInvoices.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800/80 rounded-2xl my-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Invoices Recorded Yet</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">Start inputing receivables and billing clients for this workspace.</p>
          </div>
          <Link
            href="/invoices/new"
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" /> CREATE YOUR FIRST INVOICE
          </Link>
        </div>
      ) : (
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
      )}
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
