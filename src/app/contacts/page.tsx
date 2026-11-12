import React from 'react';
import { ShieldAlert, Contact } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { clientMask, HIDDEN_CLIENT } from '@/lib/auth/client-privacy';
import { loadClientRows } from '@/lib/sales/client-table';
import { loadClientPics, loadClientAddresses } from '@/lib/sales/client-pics';
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
  const ids = Array.from(first.keys());
  const [pics, addresses] = await Promise.all([loadClientPics(db, ids), loadClientAddresses(db, ids)]);

  // The WhatsApp group of each client (WA Control: Oli sends the weekly and session reports there). If the column or table is not
  // there yet, the page works as before without the group column.
  let waGroups: { id: string; label: string }[] | undefined;
  const waOf = new Map<string, string | null>();
  try {
    const [{ data: groups, error: gErr }, { data: links, error: lErr }] = await Promise.all([
      db.from('wa_groups').select('id, wa_id, name').eq('workspace_id', ctx.activeWorkspaceId).eq('is_group', true).order('name'),
      ids.length ? db.from('clients').select('id, wa_group_id').in('id', ids) : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (!gErr && !lErr) {
      waGroups = (groups || []).map((g: any) => ({ id: g.id as string, label: g.name || `Group ···${String(g.wa_id).slice(-6)}` }));
      for (const l of links || []) waOf.set(l.id, l.wa_group_id || null);
    }
  } catch { /* column not available */ }

  const rows: ContactRow[] = Array.from(first.values()).map((r) => ({ clientId: r.clientId, name: r.clientName, brand: r.brand || '', pic: pics.get(r.clientId) || '', address: addresses.get(r.clientId) || '', row: r, waGroupId: waOf.get(r.clientId) || null }));

  return (
    <div className="p-4 lg:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-[#d4af37]/10 p-3 text-[#d4af37]"><Contact className="h-7 w-7" /></div>
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-zinc-100">Client Contact</h1>
          <p className="mt-1 text-sm text-zinc-400">The same clients as Optimizing &gt; Clients. Edit a name, brand, store or PIC here or there: it changes in both places.</p>
        </div>
      </div>
      <ClientContactTable rows={rows} canEdit storeOptions={[]} waGroups={waGroups} />
    </div>
  );
}
