import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Package, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { withoutProspects } from '@/lib/sales/prospects';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';
import { createAdminClient } from '@/lib/api/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ type?: string, historical?: string, request?: string }> }) {
  const resolvedParams = await searchParams;
  const isQuotation = resolvedParams.type === 'quotation';
  const isHistorical = resolvedParams.historical === 'true';

  const supabase = await createClient();
  const { activeWorkspaceId, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: clients } = await withoutProspects((hide) => {
    let clientQuery = supabase.from('clients').select('id, name, company_legal_name, company_name, workspace_id, contact_type');
    if (activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
      clientQuery = clientQuery.or(`workspace_id.in.(11111111-1111-1111-1111-111111111111,f7262187-2a08-4454-b046-b4fd91f2f642,b9f6425f-ad1f-4911-a182-ab788c5fa0e3),workspace_id.is.null`);
    } else {
      clientQuery = clientQuery.or(`workspace_id.eq.${activeWorkspaceId},workspace_id.is.null`);
    }
    if (hide) clientQuery = clientQuery.eq('is_prospect', false);
    return clientQuery.order('name', { ascending: true });
  });
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

  const clientList: any[] = [...(clients || [])];
  const productList = products || [];

  // Made from a salesman's invoice request: start with the client and the products he picked.
  let requestData: any = null;
  if (resolvedParams.request) {
    const { data: req } = await createAdminClient()
      .from('invoice_requests')
      .select('id, client_id, items, note, status, requested_by_name')
      .eq('id', resolvedParams.request)
      .eq('workspace_id', activeWorkspaceId)
      .maybeSingle();
    if (req && req.status === 'requested') requestData = req;
  }
  // The requested client must be in the picker even if the normal list would not show it (workspace, prospect flag...).
  if (requestData && !clientList.some((c: any) => c.id === requestData.client_id)) {
    const { data: rc } = await createAdminClient()
      .from('clients')
      .select('id, name, company_legal_name, company_name, workspace_id, contact_type')
      .eq('id', requestData.client_id)
      .maybeSingle();
    if (rc) clientList.unshift(rc);
  }
  const requestInitialData = requestData
    ? {
        requestId: requestData.id,
        clientId: requestData.client_id,
        notes: requestData.note || '',
        lineItems: (requestData.items || []).map((it: any) => ({
          packageName: it.name,
          description: it.name,
          quantity: it.quantity || 1,
          scale: it.scale || 'pc',
          unitPrice: it.unit_price || 0,
          discountAmount: 0,
        })),
      }
    : undefined;

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
          href="/optimizing/catalog"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gold-glass-panel text-xs font-bold text-[#f5d77f] hover:border-[#d4af37] transition-all"
        >
          <Package className="w-3.5 h-3.5" />
          <span>MANAGE PRODUCT CATALOG</span>
        </Link>
      </div>

      {requestData && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 text-xs text-sky-200">
          Invoice request from <b>{requestData.requested_by_name || 'Sales'}</b>. The client and products are filled in; check the prices, then save. The salesman is told when you do.
        </div>
      )}
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
        <NewInvoiceForm clients={clientList} products={productList} bankAccounts={bankAccounts || []} isHistorical={isHistorical} activeWorkspaceId={activeWorkspaceId} availableWorkspaces={availableWorkspaces} isTaxRegistered={isTaxRegistered} initialData={requestInitialData} />
      </Suspense>
    </div>
  );
}
