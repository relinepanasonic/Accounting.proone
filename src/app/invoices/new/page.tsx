import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Package, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage({ searchParams }: { searchParams: { historical?: string } }) {
  const supabase = await createClient();
  const { activeWorkspaceId, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: clients } = await supabase.from('clients').select('id, name').order('name', { ascending: true });
  const { data: products } = await supabase.from('products').select('*').eq('workspace_id', activeWorkspaceId);
  const { data: bankAccounts } = await supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', activeWorkspaceId).order('is_default', { ascending: false });

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
              <span>NEW INVOICE</span>
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

      {searchParams.historical === 'true' && (
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
        <NewInvoiceForm clients={clientList} products={productList} bankAccounts={bankAccounts || []} isHistorical={searchParams.historical === 'true'} activeWorkspaceId={activeWorkspaceId} availableWorkspaces={availableWorkspaces} />
      </Suspense>
    </div>
  );
}
