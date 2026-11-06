import React from 'react';
import { ShieldAlert, Contact } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { clientMask, HIDDEN_CLIENT } from '@/lib/auth/client-privacy';
import { loadClientRows } from '@/lib/sales/client-table';
import { loadClientPics } from '@/lib/sales/client-pics';
import { ClientContactTable, type ContactRow } from '@/components/sales/ClientContactTable';

export const dynamic = 'force-dynamic';

/**
 * Accounting > Client Contact: Company Name | Brand Name | Store Name | PIC Name of every client. The same clients and the same data
 * as Optimizing > Clients (no copy), without the admin / advertiser assignment.
 */
export default async function ClientContactPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!FINANCE_ROLES.includes(ctx.role)) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Client Contact is for accounting, admin, superadmin and the founder.</p>
      </div>
    );
  }
  const mask = clientMask({ userEmail: ctx.userEmail, availableWorkspaces: ctx.availableWorkspaces });
  const db = createAdminClient();
  const all = await loadClientRows(db, ctx.activeWorkspaceId, { archived: 'all', includeAll: true, maskName: (name, ws) => mask.name(name, ws, 'Client') });

  const first = new Map<string, (typeof all)[number]>();
  // a client that is hidden from this viewer is not listed at all (its brand, store and PIC would show who it is)
  for (const r of all) if (!first.has(r.clientId) && r.clientName !== HIDDEN_CLIENT) first.set(r.clientId, r);
  const pics = await loadClientPics(db, Array.from(first.keys()));
  const rows: ContactRow[] = Array.from(first.values()).map((r) => ({ clientId: r.clientId, name: r.clientName, brand: r.brand || '', pic: pics.get(r.clientId) || '', row: r }));

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-[#d4af37]/10 p-3 text-[#d4af37]"><Contact className="h-7 w-7" /></div>
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-zinc-100">Client Contact</h1>
          <p className="mt-1 text-sm text-zinc-400">The same clients as Optimizing &gt; Clients. Edit a name, brand, store or PIC here or there: it changes in both places.</p>
        </div>
      </div>
      <ClientContactTable rows={rows} canEdit storeOptions={[]} />
    </div>
  );
}
