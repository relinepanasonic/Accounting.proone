import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { RegisterWorkspaceCard } from '@/components/settings/RegisterWorkspaceCard';
import type { BankAccountItem } from '@/app/actions/settings';

export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
  const supabase = await createClient();
  const wsContext = await getAuthenticatedWorkspaceContext();
  const activeId = wsContext.activeWorkspaceId;

  // 1. Fetch active workspace entity details
  let ws: any = null;
  if (activeId) {
    const { data } = await supabase.from('workspaces').select('*').eq('id', activeId).single();
    ws = data;
  }

  if (!ws) {
    const { data: fallbackList } = await supabase.from('workspaces').select('*').limit(1);
    ws = fallbackList?.[0];
  }

  // 2. Fetch associated bank accounts
  let bankAccounts: BankAccountItem[] = [];
  if (ws?.id) {
    const { data: accountsData, error } = await supabase
      .from('workspace_bank_accounts')
      .select('*')
      .eq('workspace_id', ws.id)
      .order('is_default', { ascending: false });

    if (!error && accountsData && accountsData.length > 0) {
      bankAccounts = accountsData.map((acc: any) => ({
        id: acc.id,
        bank_name: acc.bank_name,
        account_number: acc.account_number,
        account_name: acc.account_name,
        is_default: Boolean(acc.is_default),
      }));
    } else if (ws.payment_instructions) {
      // Legacy parse fallback if payment_instructions textarea exists
      const lines = ws.payment_instructions.split('\n').filter((l: string) => l.trim().length > 0);
      if (lines.length > 0) {
        bankAccounts = lines.map((line: string, idx: number) => ({
          id: `temp-legacy-${idx}`,
          bank_name: idx === 0 ? 'Primary Bank Account' : `Secondary Bank (${idx + 1})`,
          account_number: line.trim(),
          account_name: ws.name || 'Professor Toko Online',
          is_default: idx === 0,
        }));
      }
    }
  }

  // Default fallback if completely new workspace or no accounts
  if (bankAccounts.length === 0) {
    bankAccounts = [
      {
        id: 'temp-seed-1',
        bank_name: 'Bank BCA Corporate',
        account_number: '429-577-5778',
        account_name: ws?.name || 'Professor Toko Online',
        is_default: true,
      },
    ];
  }

  return (
    <div className="space-y-8">
      <GeneralSettingsForm
        initialName={ws?.name || wsContext.activeWorkspaceName || 'Professor Toko Online'}
        initialIsTaxRegistered={Boolean(ws?.is_tax_registered)}
        initialTaxRate={ws?.tax_rate_percent !== undefined ? Number(ws.tax_rate_percent) : 11}
        initialBankAccounts={bankAccounts}
      />

      {/* Register New Enterprise Tenant Card */}
      <RegisterWorkspaceCard />
    </div>
  );
}
