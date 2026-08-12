import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ContactCrmManager, type ClientRecord } from '@/components/settings/ContactCrmManager';

export const dynamic = 'force-dynamic';

export default async function ClientsSettingsPage() {
  const supabase = await createClient();
  const wsCtx = await getAuthenticatedWorkspaceContext(supabase);

  let clientQuery = supabase.from('clients').select('*');
  if (wsCtx.activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
    clientQuery = clientQuery.or(`workspace_id.in.(11111111-1111-1111-1111-111111111111,f7262187-2a08-4454-b046-b4fd91f2f642,b9f6425f-ad1f-4911-a182-ab788c5fa0e3),workspace_id.is.null`);
  } else {
    clientQuery = clientQuery.or(`workspace_id.eq.${wsCtx.activeWorkspaceId},workspace_id.is.null`);
  }

  const { data: clients } = await clientQuery.order('name', { ascending: true });

  const { data: invoices } = await supabase.from('invoices').select('client_id, total_amount').neq('status', 'void');
  const invoiceTotals = (invoices || []).reduce((acc, inv) => {
    if (inv.client_id) acc[inv.client_id] = (acc[inv.client_id] || 0) + (Number(inv.total_amount) || 0);
    return acc;
  }, {} as Record<string, number>);

  const { data: transactions } = await supabase.from('transactions').select('client_id, amount').not('client_id', 'is', null);
  const expenseTotals = (transactions || []).reduce((acc, tx) => {
    if (tx.client_id) acc[tx.client_id] = (acc[tx.client_id] || 0) + (Number(tx.amount) || 0);
    return acc;
  }, {} as Record<string, number>);

  const clientList: ClientRecord[] = (clients || []).map((c: any) => ({
    id: c.id,
    name: c.name || 'Client',
    company: c.contact_name || c.company_name || c.company || c.name || '',
    company_legal_name: c.company_legal_name || '',
    email: c.email || '',
    contactType: c.contact_type || 'client',
    workspace_id: c.workspace_id,
    totalSales: invoiceTotals[c.id] || 0,
    totalExpenses: expenseTotals[c.id] || 0,
  }));

  return (
    <ContactCrmManager 
      initialClients={clientList} 
      currentUserRole={wsCtx.role} 
      activeWorkspaceId={wsCtx.activeWorkspaceId}
      availableWorkspaces={wsCtx.availableWorkspaces}
    />
  );
}
