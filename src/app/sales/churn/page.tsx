import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { loadClientRows } from '@/lib/sales/client-table';
import { ClientProjectsTable } from '@/components/sales/ClientProjectsTable';

export const dynamic = 'force-dynamic';

/** Sales > Churn: clients whose project ended in an earlier month. They stay in Client until the end of the month they churned. */
export default async function SalesChurnPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, role, userId, userEmail, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);
  const mask = clientMask({ userEmail, availableWorkspaces });
  const canEdit = ['accounting', 'admin', 'superadmin', 'founder'].includes(role);

  const rows = await loadClientRows(createAdminClient(), activeWorkspaceId, {
    salesmanId: role === 'sales' ? userId || undefined : undefined,
    archived: 'only',
    maskName: (name, ws) => mask.name(name, ws, 'Client'),
  });
  // Newest churn first.
  const groups: typeof rows[] = [];
  for (const r of rows) (r.groupIndex === 0 ? groups.push([r]) : groups[groups.length - 1]?.push(r));
  groups.sort((a, b) => String(b[0].churnDate || '').localeCompare(String(a[0].churnDate || '')));
  const sorted = groups.flat();
  const clients = new Set(rows.map((r) => r.clientId)).size;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Churn</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Clients whose project ended before this month. They stay in Client until the end of the month they churned, then move here.
          {canEdit ? ' To bring one back, set its status to Auto.' : ''}
        </p>
        <p className="mt-2 text-xs text-zinc-500">{clients} client{clients === 1 ? '' : 's'} · {groups.length} invoice{groups.length === 1 ? '' : 's'}</p>
      </div>
      <ClientProjectsTable rows={sorted} showStatus canEditStart={false} canEditNames={false} canEditStatus={canEdit} />
    </div>
  );
}
