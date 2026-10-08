import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { loadClientRows } from '@/lib/sales/client-table';
import { ClientProjectsTable } from '@/components/sales/ClientProjectsTable';
import { ReceivablesSection } from '@/components/sales/ReceivablesSection';

export const dynamic = 'force-dynamic';

export default async function SalesClientsPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, role, userId, userEmail, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);
  const canEdit = ['accounting', 'admin', 'superadmin', 'founder'].includes(role);
  const mask = clientMask({ userEmail, availableWorkspaces });
  const db = createAdminClient();

  const rows = await loadClientRows(db, activeWorkspaceId, {
    salesmanId: role === 'sales' ? userId || undefined : undefined,
    maskName: (name, ws) => mask.name(name, ws, 'Client'),
  });
  const clients = new Set(rows.map((r) => r.clientId)).size;
  const invoicesOnly = rows.filter((r) => r.groupIndex === 0);
  const count = (l: string) => invoicesOnly.filter((r) => r.lifecycle === l).length;

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Clients</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Every product each client took, from the moment its invoice exists. Accounting types the paid date and picks the project start date; the end date follows from each product&apos;s length.{!canEdit && ' You can look at this table but not change it.'}
        </p>
        <p className="mt-2 text-xs text-zinc-500">{clients} client{clients === 1 ? '' : 's'} · Active {count('active')} · Scheduled {count('scheduled')} · Freeze {count('freeze')} · Churn this month {count('churn')}. A churned client moves to the Churn page next month.</p>
      </div>

      <ClientProjectsTable
        rows={rows}
        showStatus
        canEditStart={canEdit}
        canEditNames={canEdit}
        canEditPaid={canEdit}
        canEditStatus={canEdit}
      />

      {role !== 'sales' && (
        <ReceivablesSection supabase={supabase} workspaceId={activeWorkspaceId} userEmail={userEmail} availableWorkspaces={availableWorkspaces} />
      )}
    </div>
  );
}
