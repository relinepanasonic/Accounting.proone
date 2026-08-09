import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Package, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ type?: string, historical?: string }> }) {
  const resolvedParams = await searchParams;
  const isQuotation = resolvedParams.type === 'quotation';
  const isHistorical = resolvedParams.historical === 'true';

  const supabase = await createClient();
  const { activeWorkspaceId, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: clients } = await supabase.from('clients').select('id, name, company_legal_name, company_name').eq('workspace_id', activeWorkspaceId).order('name', { ascending: true });
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
              <FileText className="w-5 h-5 text-[#d4af37]" />
              <span>{isQuotation ? 'NEW QUOTATION' : 'NEW INVOICE'}</span>
            </h1>
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

      {isHistorical && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase">Historical Opening Balance Mode</h3>
            <p className="text-[10px] text-zinc-400 font-sans">
              This invoice will be logged as historical Piutang. It will credit Retained Earnings and will NOT artificially inflate current-year revenue.
            </p>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="h-40 bg-zinc-900 rounded-xl animate-pulse" />}>
        <NewInvoiceForm clients={clientList} products={productList} bankAccounts={bankAccounts || []} isHistorical={isHistorical} activeWorkspaceId={activeWorkspaceId} availableWorkspaces={availableWorkspaces} isTaxRegistered={isTaxRegistered} />
      </Suspense>
    </div>
  );
}
