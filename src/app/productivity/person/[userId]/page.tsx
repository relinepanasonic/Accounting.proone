import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadActivity, loadPeople, parseRange } from '@/lib/productivity/activity';
import { PersonDetail } from '@/components/productivity/ActivityViews';

export const dynamic = 'force-dynamic';

export default async function PersonProductivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { userId } = await params;
  const range = parseRange((await searchParams).range);
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  const isOwner = ctx.role === 'founder' || ctx.role === 'superadmin';
  if (!ctx.userId) redirect('/login');
  // Anyone else may only open their own page.
  if (!isOwner && userId !== ctx.userId) redirect('/productivity/me');

  const person = (await loadPeople(supabase, ctx.activeWorkspaceId, userId))[0];
  if (!person) notFound();

  const data = await loadActivity(supabase, ctx.activeWorkspaceId, [person], range);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
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
