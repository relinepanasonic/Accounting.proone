import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { withoutProspects } from '@/lib/sales/prospects';
import { loadClientRows } from '@/lib/sales/client-table';
import { loadHandlers } from '@/lib/sales/people';
import { ClientProjectsTable } from '@/components/sales/ClientProjectsTable';
import { ContactCrmManager, type ClientRecord } from '@/components/settings/ContactCrmManager';

export const dynamic = 'force-dynamic';

/**
 * Optimizing > Clients. Two tabs:
 *  - Assign: every client product line, and (superadmin / founder) who handles each client.
 *  - Contacts: the client contact book (add, edit, delete), which used to live in Settings.
 */
export default async function OptimizingClientsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const tabParam = (await searchParams).tab;
  const tab = tabParam === 'contacts' ? 'contacts' : tabParam === 'churn' ? 'churn' : 'assign';

  if (!FINANCE_ROLES.includes(ctx.role)) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Clients are for accounting, admin, superadmin and the founder.</p>
      </div>
    );
  }
  const owner = ctx.role === 'superadmin' || ctx.role === 'founder';

  const tabs = [
    { key: 'assign', label: 'Assign & Projects', href: '/optimizing/clients' },
    { key: 'churn', label: 'Churn', href: '/optimizing/clients?tab=churn' },
    { key: 'contacts', label: 'Contacts', href: '/optimizing/clients?tab=contacts' },
  ] as const;
  const TabBar = (
    <div className="flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
            tab === t.key ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#d4af37] shadow-md' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );

  if (tab === 'contacts') {
    const { data: clients } = await withoutProspects((hide) => {
      let q = supabase.from('clients').select('*');
      if (ctx.activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
        q = q.or('workspace_id.in.(11111111-1111-1111-1111-111111111111,f7262187-2a08-4454-b046-b4fd91f2f642,b9f6425f-ad1f-4911-a182-ab788c5fa0e3),workspace_id.is.null');
      } else {
        q = q.or(`workspace_id.eq.${ctx.activeWorkspaceId},workspace_id.is.null`);
      }
      if (hide) q = q.eq('is_prospect', false);
      return q.order('name', { ascending: true });
    });

    const { data: invoices } = await supabase.from('invoices').select('client_id, total_amount').neq('status', 'void');
    const invoiceTotals = (invoices || []).reduce((acc, inv) => {
      if (inv.client_id) acc[inv.client_id] = (acc[inv.client_id] || 0) + (Number(inv.total_amount) || 0);
      return acc;
    }, {} as Record<string, number>);

    const list: ClientRecord[] = (clients || [])
      .filter((c: any) => (c.contact_type || 'client') !== 'vendor')
      .map((c: any) => ({
        id: c.id,
        name: c.name || 'Client',
        company: c.contact_name || c.company_name || c.company || c.name || '',
        company_legal_name: c.company_legal_name || '',
        email: c.email || '',
        contactType: 'client' as const,
        workspace_id: c.workspace_id,
        totalSales: invoiceTotals[c.id] || 0,
        totalExpenses: 0,
      }));

    return (
      <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Optimizing · Clients</h1>
        {TabBar}
        <ContactCrmManager
          initialClients={list}
          currentUserRole={ctx.role}
          activeWorkspaceId={ctx.activeWorkspaceId}
          availableWorkspaces={ctx.availableWorkspaces}
          mode="client"
        />
      </div>
    );
  }

  const mask = clientMask({ userEmail: ctx.userEmail, availableWorkspaces: ctx.availableWorkspaces });
  const db = createAdminClient();
  const rows = await loadClientRows(db, ctx.activeWorkspaceId, { archived: tab === 'churn' ? 'only' : 'hide', includeAll: true, maskName: (name, ws) => mask.name(name, ws, 'Client') });
  const handlers = owner ? await loadHandlers(db, ctx.activeWorkspaceId) : null;
  const clients = new Set(rows.map((r) => r.clientId)).size;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Optimizing · Clients</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {owner
            ? 'All our clients are here, also the ones without an invoice yet. Choose who handles each client: the advertiser sees it under Advertiser > Client, the admin under Admin > Client. Only assigned clients show there.'
            : 'Every client product line with its project dates and payment status. Only a superadmin or the founder assigns the advertiser and admin.'}
        </p>
        <p className="mt-2 text-xs text-zinc-500">{clients} client{clients === 1 ? '' : 's'} · {rows.length} product line{rows.length === 1 ? '' : 's'}</p>
      </div>
      {TabBar}
      <ClientProjectsTable rows={rows} showStatus canEditStart canEditNames canEditPaid canEditStatus advertisers={handlers?.advertisers} admins={handlers?.admins} />
    </div>
  );
}
