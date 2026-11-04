import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { assignedClientIds } from '@/lib/assignments/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { AdvertiserManager } from '@/components/productivity/AdvertiserManager';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadClientStores, storeText } from '@/lib/sales/client-stores';

/** Advertiser > Input Log: the session reports of the clients (what the Advertiser dashboard used to be). */
export default async function AdvertiserPerformancePage() {
  const supabase = await createClient();
  const { activeWorkspaceId, activeWorkspaceName, role } = await getAuthenticatedWorkspaceContext(supabase);

  let { data: clients } = await supabase
    .from('clients')
    .select('id, name, store_name')
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

  // The stores of each client (a client can have several): they are offered when a log starts.
  const storesOf = await loadClientStores(createAdminClient(), (clients || []).map((c) => c.id));
  const withStores = (clients || []).map((c) => ({ ...c, stores: (storesOf.get(c.id) || []).map(storeText) }));

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/advertiser" active="input" />
      <AdvertiserManager clients={withStores} />
    </div>
  );
}
