import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { InvoiceStatusToggle, InvoiceActionGroup } from '@/components/invoices/InvoiceRowActions';
import { InvoiceTableClient } from '@/components/invoices/InvoiceTableClient';

export const dynamic = 'force-dynamic';

async function InvoicesTableServer() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, is_quotation, status, total_amount, issue_date, due_date, client_id, clients(name, contact_name), invoice_line_items(description)')
    .eq('workspace_id', activeWorkspaceId)
    .order('created_at', { ascending: false });

  const displayInvoices =
    invoices && invoices.length > 0
      ? invoices.map((inv) => {
          const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
          const lineItems = Array.isArray(inv.invoice_line_items) ? inv.invoice_line_items : (inv.invoice_line_items ? [inv.invoice_line_items] : []);
          const firstPackage = lineItems.length > 0 ? lineItems[0].description : '—';
          return {
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            issueDate: inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
            rawIssueDate: inv.issue_date || '',
            clientName: clientObj?.name || 'Client',
            clientContact: clientObj?.contact_name || '',
            amount: `Rp ${Number(inv.total_amount || 0).toLocaleString('id-ID')}`,
            rawAmount: Number(inv.total_amount || 0),
            dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
            rawDueDate: inv.due_date || '',
            packageName: firstPackage,
            isQuotation: inv.is_quotation,
            status: inv.status || 'draft',
          };
        })
      : [];

  return <InvoiceTableClient initialInvoices={displayInvoices} />;
}

export default function InvoicesPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <span>INVOICES & QUOTATIONS</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/invoices/new?type=quotation"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider bg-zinc-800 text-white hover:bg-zinc-700 transition-colors border border-zinc-700"
          >
            <Plus className="w-4 h-4" />
            <span>NEW QUOTATION</span>
          </Link>
          <Link
            href="/invoices/new"
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>NEW INVOICE</span>
          </Link>
        </div>
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
