import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { WorkspacesMasterList, type WorkspaceMasterItem } from '@/components/settings/WorkspacesMasterList';

export const dynamic = 'force-dynamic';

export default async function WorkspacesMasterPage() {
  const supabase = await createClient();
  const wsContext = await getAuthenticatedWorkspaceContext();

  const activeId = wsContext.activeWorkspaceId || '';

  // Fetch user details & all workspace memberships with full workspace data
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let masterList: WorkspaceMasterItem[] = [];

  if (user) {
    const { data: memberRows, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces (*)')
      .eq('user_id', user.id);

    if (!error && memberRows && memberRows.length > 0) {
      masterList = memberRows
        .map((m: any) => {
          const wsObj = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
          if (!wsObj?.id) return null;
          const isTaxReg =
            wsObj.is_tax_registered !== undefined && wsObj.is_tax_registered !== null
              ? Boolean(wsObj.is_tax_registered)
              : Number(wsObj.tax_rate_percent || 0) > 0;
          return {
            id: wsObj.id,
            name: wsObj.name || 'Enterprise Tenant',
            role: (m.role as string) || 'accounting',
            isTaxRegistered: isTaxReg,
            taxRatePercent: wsObj.tax_rate_percent !== undefined ? Number(wsObj.tax_rate_percent) : (isTaxReg ? 11 : 0),
          };
        })
        .filter(Boolean) as WorkspaceMasterItem[];
    }
  }

  // Fallback if no memberships returned or running in preview seed mode
  if (masterList.length === 0 && wsContext.availableWorkspaces) {
    masterList = wsContext.availableWorkspaces.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      isTaxRegistered: false,
      taxRatePercent: 11,
    }));
  }

  return <WorkspacesMasterList workspaces={masterList} activeWorkspaceId={activeId} />;
}
