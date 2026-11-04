import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { loadClientRows } from '@/lib/sales/client-table';
import { loadHandlers } from '@/lib/sales/people';
import { ClientStoreTable } from '@/components/sales/ClientStoreTable';
import { fetchPerformance, storeLabel } from '@/lib/integrations/performance';

export const dynamic = 'force-dynamic';

/**
 * Optimizing > Clients. Two tabs:
 *  - Assign: every client product line, the stores of each client, and (superadmin / founder) who handles each client.
 *  - Churn: the clients that left.
 */
export default async function OptimizingClientsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const tabParam = (await searchParams).tab;
  const tab = tabParam === 'churn' ? 'churn' : 'assign';

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

  const mask = clientMask({ userEmail: ctx.userEmail, availableWorkspaces: ctx.availableWorkspaces });
  const db = createAdminClient();
  const rows = await loadClientRows(db, ctx.activeWorkspaceId, { archived: tab === 'churn' ? 'only' : 'all', includeAll: true, maskName: (name, ws) => mask.name(name, ws, 'Client') });
  const handlers = owner ? await loadHandlers(db, ctx.activeWorkspaceId) : null;

  // The stores of the two apps (this year), to pick "Workspace - Store" for each client. A short wait: if an app is slow, the box still takes typed text.
  const year = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const [dashStores, relineStores] = await Promise.all([fetchPerformance('dashboard', `${year}-01-01`, `${year}-12-31`, 8000), fetchPerformance('reline', `${year}-01-01`, `${year}-12-31`, 8000)]);
  const storeOptions = Array.from(new Set([...(dashStores.ok ? dashStores.rows : []), ...(relineStores.ok ? relineStores.rows : [])].map((r) => storeLabel(r)))).sort((a, b) => a.localeCompare(b));

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Optimizing · Clients</h1>
      </div>
      {TabBar}
      <ClientStoreTable rows={rows} canEditStart canEditNames canEditStatus canEditSales={owner} advertisers={handlers?.advertisers} admins={handlers?.admins} storeOptions={storeOptions} />
    </div>
  );
}
