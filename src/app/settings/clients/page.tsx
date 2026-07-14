import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ClientCrmManager, type ClientRecord } from '@/components/settings/ClientCrmManager';

export const dynamic = 'force-dynamic';

export default async function ClientsSettingsPage() {
  const supabase = await createClient();
  const wsCtx = await getAuthenticatedWorkspaceContext(supabase);

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', wsCtx.activeWorkspaceId)
    .order('name', { ascending: true });

  const clientList: ClientRecord[] = (clients || []).map((c: any) => ({
    id: c.id,
    name: c.name || 'Client',
    company: c.contact_name || c.company_name || c.company || c.name || '',
    email: c.email || '',
  }));

  return <ClientCrmManager initialClients={clientList} currentUserRole={wsCtx.role} />;
}
