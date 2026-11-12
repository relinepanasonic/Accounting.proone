import React from 'react';
import { notFound } from 'next/navigation';
import { waAccess, parseDays, TEAM_ROLES, type TeamRole } from '@/lib/wa/queries';
import { WaBoard } from '@/components/wa/WaBoard';
import { WaNoAccess } from '@/components/wa/WaNoAccess';

export const dynamic = 'force-dynamic';

/** HRD > WA Control > Admin | Advertiser | Sales: only what that team says and how fast it answers. */
export default async function WaRolePage({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { role } = await params;
  if (!(TEAM_ROLES as readonly string[]).includes(role)) notFound();
  const ctx = await waAccess();
  if (!ctx) return <WaNoAccess />;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  return <WaBoard workspaceId={ctx.activeWorkspaceId} role={role as TeamRole} days={parseDays(sp.days)} groupId={one(sp.group)} q={one(sp.q)} />;
}
