import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatIndoDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { InvoiceStatusToggle, InvoiceActionGroup } from '@/components/invoices/InvoiceRowActions';
import { InvoiceTableClient } from '@/components/invoices/InvoiceTableClient';

export const dynamic = 'force-dynamic';

async function InvoicesTableServer({ activeTab }: { activeTab: string }) {
  const supabase = await createClient();
  const { activeWorkspaceId, activeWorkspaceName, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);

  const [
    { data: invoices },
    { data: incomeTx }
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, is_quotation, status, total_amount, amount_paid, issue_date, due_date, client_id, assigned_workspace_id, clients(name, contact_name), invoice_line_items(package_name, description, quantity, scale), assignedWorkspaces:workspaces!invoices_assigned_workspace_id_fkey(name)')
      .or(`workspace_id.eq.${activeWorkspaceId},assigned_workspace_id.eq.${activeWorkspaceId}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('id, description, amount, transaction_date, category')
      .eq('workspace_id', activeWorkspaceId)
      .eq('type', 'income')
      .order('transaction_date', { ascending: false })
  ]);

  const displayInvoices =
    invoices && invoices.length > 0
      ? invoices.map((inv) => {
          const clientObj = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
          const lineItems = Array.isArray(inv.invoice_line_items) ? inv.invoice_line_items : (inv.invoice_line_items ? [inv.invoice_line_items] : []);
          const firstPackage = lineItems.length > 0 ? (lineItems[0].package_name || lineItems[0].description || '—') : '—';
          const firstPackageQtt = lineItems.length > 0 ? `${Number(lineItems[0].quantity)} ${lineItems[0].scale || ''}`.trim() : '—';
          return {
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            issueDate: formatIndoDate(inv.issue_date),
            rawIssueDate: inv.issue_date || '',
            clientName: clientObj?.name || 'Client',
            clientContact: clientObj?.contact_name || '',
            amount: `Rp ${Number(inv.total_amount || 0).toLocaleString('en-US')}`,
            rawAmount: Number(inv.total_amount || 0),
            paidAmount: Number(inv.amount_paid || 0),
            dueDate: formatIndoDate(inv.due_date),
            rawDueDate: inv.due_date || '',
            packageName: firstPackage,
            packageQtt: firstPackageQtt,
            isQuotation: inv.is_quotation,
            status: inv.status || 'draft',
            assignedWorkspaceId: inv.assigned_workspace_id,
            assignedWorkspaceName: inv.assignedWorkspaces ? (Array.isArray(inv.assignedWorkspaces) ? (inv.assignedWorkspaces as any[])[0]?.name : (inv.assignedWorkspaces as any).name) : 'No Assignment',
          };
        })
      : [];

  const displayIncomeTx =
    incomeTx && incomeTx.length > 0
      ? incomeTx.map((tx) => ({
          id: tx.id,
          invoiceNumber: 'DIRECT INCOME',
          issueDate: formatIndoDate(tx.transaction_date),
          rawIssueDate: tx.transaction_date || '',
          clientName: tx.description || 'Quick Income',
          clientContact: '',
          amount: `Rp ${Number(tx.amount || 0).toLocaleString('en-US')}`,
          rawAmount: Number(tx.amount || 0),
          paidAmount: Number(tx.amount || 0),
          dueDate: formatIndoDate(tx.transaction_date),
          rawDueDate: tx.transaction_date || '',
          packageName: tx.category || 'Categorized Income',
          packageQtt: '—',
          isQuotation: false,
          status: 'paid',
          assignedWorkspaceId: activeWorkspaceId,
          assignedWorkspaceName: activeWorkspaceName,
        }))
      : [];

  const finalInvoices = (activeTab === 'direct' ? displayIncomeTx : displayInvoices).sort(
    (a, b) => new Date(b.rawIssueDate || 0).getTime() - new Date(a.rawIssueDate || 0).getTime()
  );

  return <InvoiceTableClient initialInvoices={finalInvoices} availableWorkspaces={availableWorkspaces} activeWorkspaceName={activeWorkspaceName} />;
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await searchParams;
  const activeTab = typeof resolvedParams.tab === 'string' ? resolvedParams.tab : 'invoices';

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <span>INCOME & QUOTATIONS</span>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-[#d4af37]/20 w-fit">
        <Link
          href="?tab=invoices"
          className={`px-6 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${
            activeTab === 'invoices'
              ? 'bg-gradient-to-r from-[#d4af37]/20 to-[#d4af37]/5 text-[#f5d77f] border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          Invoices
        </Link>
        <Link
          href="?tab=direct"
          className={`px-6 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${
            activeTab === 'direct'
              ? 'bg-gradient-to-r from-[#d4af37]/20 to-[#d4af37]/5 text-[#f5d77f] border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          Direct Income
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="gold-glass-panel rounded-2xl h-80 animate-pulse p-6"></div>
        }
      >
        <InvoicesTableServer activeTab={activeTab} />
      </Suspense>
    </div>
  );
}
