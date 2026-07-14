import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { WorkspaceDetailTabs } from '@/components/settings/WorkspaceDetailTabs';
import type { BankAccountItem } from '@/app/actions/settings';
import type { CatalogProduct } from '@/components/settings/CatalogManager';

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

  // Concurrently fetch exact workspace entity, bank accounts, and products by target ID
  const [wsRes, accountsRes, productsRes] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', targetId).single(),
    supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', targetId).order('is_default', { ascending: false }),
    supabase.from('products').select('*').eq('workspace_id', targetId).order('created_at', { ascending: false }),
  ]);

  const { data: ws, error: wsErr } = wsRes;

  if (wsErr || !ws) {
    // Check fallback in preview seed mode if not in database
    const seedWs = wsContext.availableWorkspaces?.find((w) => w.id === targetId);
    if (!seedWs) {
      return notFound();
    }
  }

  const workspaceName =
    ws?.name || wsContext.availableWorkspaces?.find((w) => w.id === targetId)?.name || 'Enterprise Tenant';
  const isTaxRegistered = Boolean(ws?.is_tax_registered);
  const taxRatePercent = ws?.tax_rate_percent !== undefined ? Number(ws.tax_rate_percent) : 11;

  // Process bank accounts data
  let bankAccounts: BankAccountItem[] = [];
  if (!accountsRes.error && accountsRes.data && accountsRes.data.length > 0) {
    bankAccounts = accountsRes.data.map((acc: any) => ({
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

  // Process products data
  const productList: CatalogProduct[] =
    productsRes.data && productsRes.data.length > 0
      ? productsRes.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || undefined,
          unit_price: Number(p.unit_price) || 0,
        }))
      : [];

  const isCurrentActive = targetId === activeId;

  return (
    <WorkspaceDetailTabs
      targetWorkspaceId={targetId}
      workspaceName={workspaceName}
      isTaxRegistered={isTaxRegistered}
      taxRatePercent={taxRatePercent}
      bankAccounts={bankAccounts}
      products={productList}
      isCurrentActive={isCurrentActive}
    />
  );
}
