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
    let memberRows: any[] | null = null;
    const { data: byUser, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces (*)')
      .eq('user_id', user.id);

    if (!error && byUser && byUser.length > 0) {
      memberRows = byUser;
    } else if (user.email) {
      const { data: byEmail } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces (*)')
        .ilike('email', user.email.trim());
      if (byEmail && byEmail.length > 0) {
        memberRows = byEmail;
      }
    }

    if (memberRows && memberRows.length > 0) {
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

  // If no explicit memberships found, fetch all real workspaces from database before ever using seed!
  if (masterList.length === 0) {
    const { data: realWs } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });

    if (realWs && realWs.length > 0) {
      masterList = realWs.map((wsObj: any) => {
        const isTaxReg =
          wsObj.is_tax_registered !== undefined && wsObj.is_tax_registered !== null
            ? Boolean(wsObj.is_tax_registered)
            : Number(wsObj.tax_rate_percent || 0) > 0;
        return {
          id: wsObj.id,
          name: wsObj.name || 'Enterprise Tenant',
          role: 'accounting',
          isTaxRegistered: isTaxReg,
          taxRatePercent: wsObj.tax_rate_percent !== undefined ? Number(wsObj.tax_rate_percent) : (isTaxReg ? 11 : 0),
        };
      });
    } else if (wsContext.availableWorkspaces) {
      masterList = wsContext.availableWorkspaces.map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        isTaxRegistered: false,
        taxRatePercent: 11,
      }));
    }
  }

  return <WorkspacesMasterList workspaces={masterList} activeWorkspaceId={activeId} />;
}
