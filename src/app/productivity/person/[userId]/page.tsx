import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadActivity, loadPeople, parseRange } from '@/lib/productivity/activity';
import { PersonDetail } from '@/components/productivity/ActivityViews';
import { loadKpi } from '@/lib/kpi/load';
import { KpiBoard } from '@/components/kpi/KpiBoard';

export const dynamic = 'force-dynamic';

export default async function PersonProductivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ range?: string; kc?: string }>;
}) {
  const { userId } = await params;
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  const isOwner = ctx.role === 'founder' || ctx.role === 'superadmin';
  if (!ctx.userId) redirect('/login');
  // Anyone else may only open their own page.
  if (!isOwner && userId !== ctx.userId) redirect('/productivity/me');

  const person = (await loadPeople(supabase, ctx.activeWorkspaceId, userId))[0];
  if (!person) notFound();

  const kpi = await loadKpi(person, ctx.activeWorkspaceId, { chartClient: sp.kc });
  const data = await loadActivity(supabase, ctx.activeWorkspaceId, [person], range);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <KpiBoard kpi={kpi} basePath={`/productivity/person/${userId}`} title={`${person.name} · KPI`} />
      <PersonDetail
        activity={data.activities[0]}
        range={range}
        rangeLabel={data.bounds.label}
        basePath={`/productivity/person/${userId}`}
        backHref={isOwner ? `/productivity?range=${range}` : undefined}
        adminLogError={data.adminLogError}
      />
    </div>
  );
}
