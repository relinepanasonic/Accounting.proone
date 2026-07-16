import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: clients } = await supabase.from('clients').select('id, name').eq('workspace_id', activeWorkspaceId);
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
              <span>NEW INVOICE GENERATOR • LUXURY GOLD EXECUTIVE HUD</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              INSTANT CATALOG AUTO-FILL & COMPUTATION ENGINE
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

      <NewInvoiceForm clients={clientList} products={productList} bankAccounts={bankAccounts || []} />
    </div>
  );
}
