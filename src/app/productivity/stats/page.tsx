import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadActivity, loadPeople, parseRange, type Person } from '@/lib/productivity/activity';
import { PersonDetail } from '@/components/productivity/ActivityViews';
import { loadKpi } from '@/lib/kpi/load';
import { KpiBoard } from '@/components/kpi/KpiBoard';
import { PlanHeader } from '@/components/productivity/PlanViews';
import { ProductivityTabs } from '@/components/productivity/ProductivityTabs';

export const dynamic = 'force-dynamic';

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string; kc?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId) redirect('/login');
  const sp = await searchParams;
  const range = parseRange(sp.range);

  // Always the signed-in person.
  let person: Person | undefined = (await loadPeople(supabase, ctx.activeWorkspaceId, ctx.userId))[0];
  if (!person) person = { userId: ctx.userId, name: ctx.userName || 'Me', email: ctx.userEmail || '', role: ctx.role };

  const isOwner = ctx.role === 'founder' || ctx.role === 'superadmin';
  const data = await loadActivity(supabase, ctx.activeWorkspaceId, [person], range);
  // The KPI board is for staff. Founder and superadmin have the Team tab instead.
  const kpi = isOwner ? null : await loadKpi(person, ctx.activeWorkspaceId, { chartClient: sp.kc });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 pb-28 animate-in fade-in duration-300">
      <PlanHeader name={person.name} subtitle={`${ctx.activeWorkspaceName} · how you are doing`} />
      <ProductivityTabs isOwner={isOwner} />
      {kpi && <KpiBoard kpi={kpi} basePath="/productivity/stats" title="My KPI" />}
      <h2 className="pt-2 font-serif text-lg font-extrabold text-zinc-100">Activity log</h2>
      <PersonDetail
        activity={data.activities[0]}
        range={range}
        rangeLabel={data.bounds.label}
        basePath="/productivity/stats"
        backHref={undefined}
        adminLogError={data.adminLogError}
      />
    </div>
  );
}
