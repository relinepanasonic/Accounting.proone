import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { COASettingsHUD } from '@/components/settings/COASettingsHUD';

export const dynamic = 'force-dynamic';

export default async function COASettingsPage() {
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

  // Fetch COA
  const { data: accounts, error } = await supabase
    .from('global_chart_of_accounts')
    .select('*')
    .order('account_code', { ascending: true });

  if (error) {
    console.error('Failed to load COA:', error);
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
      />
    </div>
  );
}
