import React from 'react';
import { waAccess, parseDays } from '@/lib/wa/queries';
import { WaBoard } from '@/components/wa/WaBoard';
import { WaNoAccess } from '@/components/wa/WaNoAccess';

export const dynamic = 'force-dynamic';

/** HRD > WA Control > Dashboard: every chat and every team member of this company. */
export default async function WaDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await waAccess();
  if (!ctx) return <WaNoAccess />;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  return <WaBoard workspaceId={ctx.activeWorkspaceId} role={null} days={parseDays(sp.days)} groupId={one(sp.group)} q={one(sp.q)} />;
}
