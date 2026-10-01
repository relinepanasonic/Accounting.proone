import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadActivity, loadPeople, parseRange, type Person } from '@/lib/productivity/activity';
import { PersonDetail } from '@/components/productivity/ActivityViews';
import { loadKpi } from '@/lib/kpi/load';
import { KpiBoard } from '@/components/kpi/KpiBoard';

export const dynamic = 'force-dynamic';

export default async function MyProductivityPage({ searchParams }: { searchParams: Promise<{ range?: string; kc?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const sp = await searchParams;
  const range = parseRange(sp.range);

  // Always the signed-in person: nothing in the address can show someone else here.
  let person: Person | undefined = ctx.userId ? (await loadPeople(supabase, ctx.activeWorkspaceId, ctx.userId))[0] : undefined;
  if (!person && ctx.userId) {
    // The founder is not a workspace member row, so build the person from the session.
    person = { userId: ctx.userId, name: ctx.userName || 'Me', email: ctx.userEmail || '', role: ctx.role };
  }

  if (!person) {
    return <div className="p-8 text-sm text-zinc-400">Nothing to show for this account.</div>;
  }

  // The KPI board is for staff. Founder and superadmin have the team overview instead.
  const isOwner = ctx.role === 'founder' || ctx.role === 'superadmin';
  const kpi = isOwner ? null : await loadKpi(person, ctx.activeWorkspaceId, { chartClient: sp.kc });
  const data = await loadActivity(supabase, ctx.activeWorkspaceId, [person], range);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {kpi && <KpiBoard kpi={kpi} basePath="/productivity/me" />}
      <h2 className="pt-4 text-lg font-extrabold text-zinc-100 font-serif">{kpi ? 'Activity log' : 'My productivity'}</h2>
      <PersonDetail
        activity={data.activities[0]}
        range={range}
        rangeLabel={data.bounds.label}
        basePath="/productivity/me"
        backHref={ctx.role === 'founder' || ctx.role === 'superadmin' ? '/productivity' : undefined}
        adminLogError={data.adminLogError}
      />
    </div>
  );
}
