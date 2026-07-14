import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, ShieldCheck, Sparkles, Sliders, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { CatalogManager, type CatalogProduct } from '@/components/settings/CatalogManager';
import type { BankAccountItem } from '@/app/actions/settings';

export const dynamic = 'force-dynamic';

interface WorkspaceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceDetailPage({ params }: WorkspaceDetailPageProps) {
  const { id: targetId } = await params;
  if (!targetId) return notFound();

  const supabase = await createClient();
  const wsContext = await getAuthenticatedWorkspaceContext();
  const activeId = wsContext.activeWorkspaceId;

  // 1. Fetch exact workspace entity by ID
  const { data: ws, error: wsErr } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', targetId)
    .single();

  if (wsErr || !ws) {
    // If not found in database, check if it's one of the seed workspaces in preview mode
    const seedWs = wsContext.availableWorkspaces?.find((w) => w.id === targetId);
    if (!seedWs) {
      return notFound();
    }
  }

  const workspaceName = ws?.name || wsContext.availableWorkspaces?.find((w) => w.id === targetId)?.name || 'Enterprise Tenant';
  const isTaxRegistered = Boolean(ws?.is_tax_registered);
  const taxRatePercent = ws?.tax_rate_percent !== undefined ? Number(ws.tax_rate_percent) : 11;

  // 2. Fetch associated bank accounts for targetId
  let bankAccounts: BankAccountItem[] = [];
  const { data: accountsData, error: accErr } = await supabase
    .from('workspace_bank_accounts')
    .select('*')
    .eq('workspace_id', targetId)
    .order('is_default', { ascending: false });

  if (!accErr && accountsData && accountsData.length > 0) {
    bankAccounts = accountsData.map((acc: any) => ({
      id: acc.id,
      bank_name: acc.bank_name,
      account_number: acc.account_number,
      account_name: acc.account_name,
      is_default: Boolean(acc.is_default),
    }));
  } else if (ws?.payment_instructions) {
    const lines = ws.payment_instructions.split('\n').filter((l: string) => l.trim().length > 0);
    if (lines.length > 0) {
      bankAccounts = lines.map((line: string, idx: number) => ({
        id: `temp-legacy-${idx}`,
        bank_name: idx === 0 ? 'Primary Bank Account' : `Secondary Bank (${idx + 1})`,
        account_number: line.trim(),
        account_name: workspaceName,
        is_default: idx === 0,
      }));
    }
  }

  // 3. Fetch products belonging specifically to targetId
  const { data: productsData } = await supabase
    .from('products')
    .select('*')
    .eq('workspace_id', targetId)
    .order('created_at', { ascending: false });

  const productList: CatalogProduct[] =
    productsData && productsData.length > 0
      ? productsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || undefined,
          unit_price: Number(p.unit_price) || 0,
        }))
      : [];

  const isCurrentActive = targetId === activeId;

  return (
    <div className="space-y-10 pb-16">
      {/* Top Breadcrumb & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="space-y-2">
          <Link
            href="/settings/workspaces"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase text-zinc-400 hover:text-[#f5d77f] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>BACK TO ENTERPRISE TENANT DIRECTORY</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#18233c] to-[#0b0c10] border border-[#d4af37] flex items-center justify-center font-extrabold text-[#f5d77f] text-lg shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              {workspaceName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-white font-serif tracking-wide">
                  {workspaceName}
                </h1>
                {isCurrentActive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    <span>ACTIVE SESSION</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                    <span>STANDBY TENANT</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5 flex items-center gap-2">
                <span>TENANT ID: {targetId}</span>
                <span>•</span>
                <span className="text-[#f5d77f]">SUPERADMIN CONTROL MATRIX</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-zinc-400 hidden md:inline">
            OPERATING DIRECTLY ON TENANT PARAMETERS
          </span>
        </div>
      </div>

      {/* SECTION 1: IDENTITY, TAX & BANK ACCOUNTS */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[#d4af37]/20 pb-3">
          <Sliders className="w-5 h-5 text-[#d4af37]" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
            TENANT IDENTITY, TAX PROFILE & BANK ACCOUNTS
          </h2>
        </div>

        <GeneralSettingsForm
          targetWorkspaceId={targetId}
          initialName={workspaceName}
          initialIsTaxRegistered={isTaxRegistered}
          initialTaxRate={taxRatePercent}
          initialBankAccounts={bankAccounts}
        />
      </div>

      {/* SECTION 2: PRODUCT & SERVICE CATALOG SPECIFIC TO THIS TENANT */}
      <div className="space-y-6 pt-6 border-t border-zinc-800">
        <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#d4af37]" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
              TENANT PRODUCT & SERVICE CATALOG
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#f5d77f] uppercase px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40">
            {productList.length} DELIVERABLE{productList.length !== 1 ? 'S' : ''}
          </span>
        </div>

        <p className="text-xs text-zinc-400 font-sans">
          Manage standard services, billable items, and default IDR pricing specific to <strong className="text-white">{workspaceName}</strong>.
        </p>

        <CatalogManager targetWorkspaceId={targetId} initialProducts={productList} />
      </div>
    </div>
  );
}
