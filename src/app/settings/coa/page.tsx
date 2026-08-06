import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { COASettingsHUD } from '@/components/settings/COASettingsHUD';

export const dynamic = 'force-dynamic';

export default async function COASettingsPage() {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Check role
  const { data: { user } } = await supabase.auth.getUser();
  let hasClearance = false;

  if (user && activeWorkspaceId) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', activeWorkspaceId)
      .limit(1)
      .single();

    if (member && (member.role === 'founder' || member.role === 'superadmin' || member.role === 'accounting')) {
      hasClearance = true;
    }
  }

  // Fetch COA for active workspace
  const { data: accounts, error } = await supabase
    .from('global_chart_of_accounts')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .order('account_code', { ascending: true });

  if (error) {
    console.error('Failed to load COA:', error);
  }

  // Fetch balances
  const { data: balancesData } = await supabase
    .from('journal_entries')
    .select('account_code, debit_amount, credit_amount')
    .eq('workspace_id', activeWorkspaceId);

  if (accounts && balancesData) {
    accounts.forEach((acc) => {
      let debit = 0;
      let credit = 0;
      balancesData.forEach((b) => {
        if (b.account_code === acc.account_code) {
          debit += Number(b.debit_amount || 0);
          credit += Number(b.credit_amount || 0);
        }
      });
      // Asset, COGS, and Expense normal balance is Debit
      if (['Asset', 'Expense', 'COGS'].includes(acc.account_type)) {
        (acc as any).balance = debit - credit;
      } else {
        (acc as any).balance = credit - debit;
      }
    });
  }

  // Fetch workspaces for dropdown
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .order('name', { ascending: true });

    return (
      <div className="space-y-6">
        <COASettingsHUD 
          accounts={accounts || []} 
          hasClearance={hasClearance} 
          workspaces={workspaces || []}
          activeWorkspaceId={activeWorkspaceId}
        />
      </div>
    );
  } catch (error) {
    console.error('Server Component Crash in COASettingsPage:', error);
    throw error;
  }
}
