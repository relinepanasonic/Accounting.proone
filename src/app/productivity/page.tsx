import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, Megaphone, Shield, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadActivity, loadPeople, parseRange } from '@/lib/productivity/activity';
import { loadKpi } from '@/lib/kpi/load';
import { KpiScoreboard } from '@/components/kpi/KpiScoreboard';
import { TeamOverview } from '@/components/productivity/ActivityViews';
import { PlanHeader } from '@/components/productivity/PlanViews';
import { ProductivityTabs } from '@/components/productivity/ProductivityTabs';

export const dynamic = 'force-dynamic';

export default async function ProductivityPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  // Only the founder and superadmins see everyone. Everyone else sees only their own page.
  if (ctx.role !== 'founder' && ctx.role !== 'superadmin') redirect('/productivity/me');

  const range = parseRange((await searchParams).range);
  const people = await loadPeople(supabase, ctx.activeWorkspaceId);
  const data = await loadActivity(supabase, ctx.activeWorkspaceId, people, range);
  // Owners (founder / superadmin) have no KPI of their own; the scoreboard is for the staff.
  const staff = people.filter((p) => p.role !== 'superadmin' && p.role !== 'founder');
  const kpiRows = await Promise.all(staff.map(async (person) => ({ person, kpi: await loadKpi(person, ctx.activeWorkspaceId) })));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 pb-28 animate-in fade-in duration-300">
      <PlanHeader name={ctx.userName || 'there'} subtitle={`${ctx.activeWorkspaceName} · what each person did`} />
      <ProductivityTabs isOwner />

      <KpiScoreboard rows={kpiRows} />

      <TeamOverview
        activities={data.activities}
        range={range}
        rangeLabel={data.bounds.label}
        salesUnlinked={data.salesUnlinked}
        adminUnlinked={data.adminUnlinked}
        adminLogError={data.adminLogError}
      />

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Divisions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/productivity/admin', name: 'Admin Division', icon: <Shield className="w-4 h-4" /> },
            { href: '/productivity/advertiser', name: 'Advertiser Division', icon: <Megaphone className="w-4 h-4" /> },
            { href: '/productivity/pabrik-sosmed', name: 'Pabrik Sosmed', icon: <Smartphone className="w-4 h-4" /> },
          ].map((d) => (
            <Link key={d.href} href={d.href} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#0e0f14] px-4 py-3 text-sm text-zinc-300 hover:border-[#d4af37]/50 hover:text-white transition-colors">
              <span className="text-[#d4af37]">{d.icon}</span>{d.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
