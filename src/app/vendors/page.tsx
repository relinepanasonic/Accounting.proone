import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ContactCrmManager, type ClientRecord } from '@/components/settings/ContactCrmManager';

export const dynamic = 'force-dynamic';

/** Accounting > Vendors: the suppliers you pay. Clients are in Settings > Contact. */
export default async function VendorsPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  let query = supabase.from('clients').select('*').eq('contact_type', 'vendor');
  if (ctx.activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
    query = query.or('workspace_id.in.(11111111-1111-1111-1111-111111111111,f7262187-2a08-4454-b046-b4fd91f2f642,b9f6425f-ad1f-4911-a182-ab788c5fa0e3),workspace_id.is.null');
  } else {
    query = query.or(`workspace_id.eq.${ctx.activeWorkspaceId},workspace_id.is.null`);
  }
  const { data: vendors } = await query.order('name', { ascending: true });

  const { data: transactions } = await supabase.from('transactions').select('client_id, amount').not('client_id', 'is', null);
  const expenseTotals = (transactions || []).reduce((acc, tx) => {
    if (tx.client_id) acc[tx.client_id] = (acc[tx.client_id] || 0) + (Number(tx.amount) || 0);
    return acc;
  }, {} as Record<string, number>);

  const list: ClientRecord[] = (vendors || []).map((c: any) => ({
    id: c.id,
    name: c.name || 'Vendor',
    company: c.contact_name || c.company_name || c.company || c.name || '',
    company_legal_name: c.company_legal_name || '',
    email: c.email || '',
    contactType: 'vendor',
    workspace_id: c.workspace_id,
    totalSales: 0,
    totalExpenses: expenseTotals[c.id] || 0,
  }));

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-[#d4af37]/20">
        <h1 className="text-lg font-extrabold tracking-wider uppercase text-white">Vendors</h1>
      </div>
      <ContactCrmManager
        initialClients={list}
        currentUserRole={ctx.role}
        activeWorkspaceId={ctx.activeWorkspaceId}
        availableWorkspaces={ctx.availableWorkspaces}
        mode="vendor"
      />
    </div>
  );
}
