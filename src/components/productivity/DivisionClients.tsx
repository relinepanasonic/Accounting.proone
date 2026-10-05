import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { assignedClientIds } from '@/lib/assignments/server';
import { loadClientRows } from '@/lib/sales/client-table';
import { ClientProjectsTable } from '@/components/sales/ClientProjectsTable';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';

/** The Sales Client table, mirrored for Advertiser / Admin: only the clients a superadmin assigned to this person, up to Product. */
export async function DivisionClients({ base, job, title }: { base: '/productivity/advertiser' | '/productivity/admin'; job: 'advertising' | 'admin'; title: string }) {
  const supabase = await createClient();
  const { activeWorkspaceId, role, userId, userEmail, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);
  const mask = clientMask({ userEmail, availableWorkspaces });
  const db = createAdminClient();
  const owner = role === 'superadmin' || role === 'founder';

  const mine = owner ? undefined : await assignedClientIds(db, activeWorkspaceId, userId || undefined, job);
  const rows = await loadClientRows(db, activeWorkspaceId, {
    clientIds: mine,
    maskName: (name, ws) => mask.name(name, ws, 'Client'),
  });
  const clients = new Set(rows.map((r) => r.clientId)).size;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base={base} active="client" />
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">{title} · Clients</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {owner ? 'All clients with an invoice. Assign who handles each one in Sales > Clients.' : 'The clients a superadmin assigned to you.'}
        </p>
        <p className="mt-2 text-xs text-zinc-500">{clients} client{clients === 1 ? '' : 's'} · {rows.length} product line{rows.length === 1 ? '' : 's'}</p>
      </div>
      <ClientProjectsTable rows={rows} showStatus={false} canEditStart={false} canEditNames={false} />
    </div>
  );
}
