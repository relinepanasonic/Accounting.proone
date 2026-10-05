import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { loadClientRows } from '@/lib/sales/client-table';
import { loadHandlers } from '@/lib/sales/people';
import { ClientProjectsTable } from '@/components/sales/ClientProjectsTable';

export const dynamic = 'force-dynamic';

/** Optimizing > Clients: the place where a superadmin or the founder hands each client to an advertiser and an admin. */
export default async function OptimizingClientsPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, role, userEmail, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);

  if (role !== 'superadmin' && role !== 'founder') {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Assigning clients is for a superadmin or the founder.</p>
      </div>
    );
  }

  const mask = clientMask({ userEmail, availableWorkspaces });
  const db = createAdminClient();
  const rows = await loadClientRows(db, activeWorkspaceId, { maskName: (name, ws) => mask.name(name, ws, 'Client') });
  const handlers = await loadHandlers(db, activeWorkspaceId);
  const clients = new Set(rows.map((r) => r.clientId)).size;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Optimizing · Clients</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Choose who handles each client. The advertiser sees it under Advertiser &gt; Client, the admin under Admin &gt; Client. Only assigned clients show there.
        </p>
        <p className="mt-2 text-xs text-zinc-500">{clients} client{clients === 1 ? '' : 's'} · {rows.length} product line{rows.length === 1 ? '' : 's'}</p>
      </div>
      <ClientProjectsTable rows={rows} showStatus canEditStart={false} canEditNames={false} advertisers={handlers.advertisers} admins={handlers.admins} />
    </div>
  );
}
