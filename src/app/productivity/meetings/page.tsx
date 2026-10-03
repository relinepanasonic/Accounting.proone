import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadLeadChoices, loadVisits } from '@/lib/productivity/planner';
import { ProductivityTabs } from '@/components/productivity/ProductivityTabs';
import { PictureWithLeads } from '@/components/productivity/today/PictureWithLeads';
import { VisitCard } from '@/components/productivity/today/VisitCard';

export const dynamic = 'force-dynamic';

const SALES_ROLES = ['sales', 'accounting', 'admin', 'superadmin', 'founder'];
const OWNERS = ['superadmin', 'founder'];

export default async function MeetingSchedulePage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId) redirect('/login');

  const canVisit = SALES_ROLES.includes(ctx.role);
  const ownOnly = ctx.role === 'sales';
  const { visits, missing } = await loadVisits(ctx.activeWorkspaceId, { userId: ownOnly ? ctx.userId : undefined, limit: 250 });
  const leads = canVisit ? await loadLeadChoices(ctx.activeWorkspaceId, { userId: ctx.userId, all: !ownOnly }) : [];

  const now = Date.now();
  const upcoming = visits.filter((v) => new Date(v.visit_at).getTime() > now).sort((a, b) => a.visit_at.localeCompare(b.visit_at));
  const past = visits.filter((v) => new Date(v.visit_at).getTime() <= now); // already newest first

  const mayDelete = (salesmanId: string) => salesmanId === ctx.userId || OWNERS.includes(ctx.role);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 pb-28 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-zinc-100">Meeting Schedule</h1>
          <p className="mt-1 text-sm text-zinc-500">{ownOnly ? 'Your meetings with leads.' : 'Meetings with leads, from the whole sales team.'}</p>
        </div>
        {canVisit && <PictureWithLeads leads={leads} variant="wide" />}
      </div>
      <ProductivityTabs />

      {missing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Meetings need one database step: run <span className="font-mono">supabase/migrations/20261004_planner.sql</span> in Supabase.
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Coming up ({upcoming.length})</h2>
        {upcoming.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No planned meeting. Use &ldquo;Picture with Leads&rdquo; and pick a future time to plan one.</div>}
        {upcoming.map((v) => <VisitCard key={v.id} visit={v} showSalesman={!ownOnly} canDelete={mayDelete(v.salesman_id)} />)}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Done ({past.length})</h2>
        {past.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No meeting logged yet.</div>}
        {past.map((v) => <VisitCard key={v.id} visit={v} showSalesman={!ownOnly} canDelete={mayDelete(v.salesman_id)} />)}
      </section>
    </div>
  );
}
