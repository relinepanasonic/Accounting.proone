import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit3, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const supabase = await createClient();
  const { activeWorkspaceId, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch the invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_line_items (*)
    `)
    .eq('id', id)
    .eq('workspace_id', activeWorkspaceId)
    .single();

  if (!invoice) {
    notFound();
  }

  // Fetch required form options
  let clientQuery = supabase.from('clients').select('id, name, company_name, company_legal_name, workspace_id, contact_type');
  if (activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
    clientQuery = clientQuery.or(`workspace_id.in.(11111111-1111-1111-1111-111111111111,f7262187-2a08-4454-b046-b4fd91f2f642,b9f6425f-ad1f-4911-a182-ab788c5fa0e3),workspace_id.is.null`);
  } else {
    clientQuery = clientQuery.or(`workspace_id.eq.${activeWorkspaceId},workspace_id.is.null`);
  }
  const { data: clients } = await clientQuery.order('name', { ascending: true });
  let productQuery = supabase.from('products').select('*');
  if (activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
    productQuery = productQuery.in('workspace_id', [
      '11111111-1111-1111-1111-111111111111',
      'f7262187-2a08-4454-b046-b4fd91f2f642',
      'b9f6425f-ad1f-4911-a182-ab788c5fa0e3',
    ]);
  } else {
    productQuery = productQuery.eq('workspace_id', activeWorkspaceId);
  }
  const { data: products } = await productQuery.order('name', { ascending: true });
  const { data: bankAccounts } = await supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', activeWorkspaceId).order('is_default', { ascending: false });
  const { data: workspaces } = await supabase.from('workspaces').select('is_tax_registered').eq('id', activeWorkspaceId).single();
  const isTaxRegistered = workspaces?.is_tax_registered || false;

  const clientList = clients || [];
  const productList = products || [];

  const rawNotes = invoice.notes || '';
  const projectDateMatch = rawNotes.match(/\[ProjectDate:([^\]]+)\]/);
  const parsedProjectDate = projectDateMatch ? projectDateMatch[1] : undefined;
  const cleanNotes = rawNotes.replace(/\[ProjectDate:[^\]]+\]\n?/, '');

  // Map database line items to form format
  const initialData = {
    id: invoice.id,
    clientId: invoice.client_id,
    invoiceNumber: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    projectDate: parsedProjectDate,
    notes: cleanNotes,
    bankAccountId: invoice.bank_account_id || 'all',
    paymentInstructions: invoice.payment_instructions || '',
    isQuotation: invoice.is_quotation || false,
    lineItems: (invoice.invoice_line_items || []).map((item: any) => ({
      id: item.id,
      packageName: item.package_name || '',
      description: item.description || '',
      quantity: item.quantity || 1,
      scale: item.scale || 'pc',
      unitPrice: item.unit_price || 0,
      discountAmount: item.discount_amount || 0,
    })),
    globalDiscount: invoice.discount_amount || 0,
    assignedWorkspaceId: invoice.assigned_workspace_id || '',
    taxCalculationType: invoice.tax_calculation_type || 'exclude',
    hasPpn: invoice.has_ppn || false,
    hasPph: invoice.has_pph || false,
    pphRate: invoice.pph_rate || 2,
    pphAmount: invoice.pph_amount || 0,
    dppAmount: invoice.dpp_amount || 0,
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-[#d4af37]" />
              <span>EDIT INVOICE • {invoice.invoice_number}</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              UPDATING EXISTING RECORD
            </p>
          </div>
        </div>
        <Link
          href="/settings/catalog"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gold-glass-panel text-xs font-bold text-[#f5d77f] hover:border-[#d4af37] transition-all"
        >
          <Package className="w-3.5 h-3.5" />
          <span>MANAGE PRODUCT CATALOG</span>
        </Link>
      </div>

      <Suspense fallback={<div className="h-40 bg-zinc-900 rounded-xl animate-pulse" />}>
        <NewInvoiceForm 
          clients={clientList} 
          products={productList} 
          bankAccounts={bankAccounts || []} 
          initialData={initialData}
          activeWorkspaceId={activeWorkspaceId}
          availableWorkspaces={availableWorkspaces}
          isTaxRegistered={isTaxRegistered}
        />
      </Suspense>
    </div>
  );
}
