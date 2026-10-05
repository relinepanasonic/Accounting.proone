import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { assignedClientIds } from '@/lib/assignments/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { AdvertiserManager } from '@/components/productivity/AdvertiserManager';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';

export default async function AdvertiserDivisionPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, activeWorkspaceName, role } = await getAuthenticatedWorkspaceContext(supabase);

  let { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', activeWorkspaceId)
    .or('contact_type.eq.client,contact_type.is.null')
    .order('name');

  const { data: userData } = await supabase.auth.getUser();

  if (role !== 'superadmin' && role !== 'founder' && clients) {
    const assignedIds = await assignedClientIds(supabase, activeWorkspaceId, userData.user?.id, 'advertising');
    {
      clients = clients.filter(c => assignedIds.has(c.id));
    }
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="dashboard" />
      <AdvertiserManager clients={clients || []} />
    </div>
  );
}
