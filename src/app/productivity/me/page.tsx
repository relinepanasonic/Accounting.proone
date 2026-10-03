import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadPeople, type Person } from '@/lib/productivity/activity';
import { loadDayPlan } from '@/lib/productivity/plan';
import { todayJakarta } from '@/lib/kpi/calendar';
import { DateStrip, PlanHeader, QuickAddButton, StatTiles } from '@/components/productivity/PlanViews';
import { PlanList } from '@/components/productivity/PlanList';
import { ProductivityTabs } from '@/components/productivity/ProductivityTabs';

export const dynamic = 'force-dynamic';

// The main action of each role: the thing the round "+" button opens.
const QUICK_ADD: Record<string, { href: string; label: string }> = {
  advertiser: { href: '/productivity/advertiser', label: 'Add an ad session report' },
  admin: { href: '/productivity/admin', label: 'Open the admin page' },
  sales: { href: '/sales/pipeline', label: 'Open the pipeline' },
  accounting: { href: '/invoices/requests', label: 'Open invoice requests' },
  superadmin: { href: '/productivity/assignments', label: 'Assign a handler' },
  founder: { href: '/productivity/assignments', label: 'Assign a handler' },
};

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId) redirect('/login');

  const today = todayJakarta();
  const asked = (await searchParams).date;
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;

  // Always the signed-in person: nothing in the address can show someone else here.
  let person: Person | undefined = (await loadPeople(supabase, ctx.activeWorkspaceId, ctx.userId))[0];
  if (!person) person = { userId: ctx.userId, name: ctx.userName || 'Me', email: ctx.userEmail || '', role: ctx.role };

  const isOwner = ctx.role === 'founder' || ctx.role === 'superadmin';
  const plan = await loadDayPlan(person, ctx.role, ctx.activeWorkspaceId, day);
  const quick = QUICK_ADD[ctx.role];
  const dayLabel = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-32 animate-in fade-in duration-300">
      <PlanHeader name={person.name} subtitle={`${ctx.activeWorkspaceName} · ${dayLabel}`} />
      <ProductivityTabs isOwner={isOwner} />
      <DateStrip selected={day} today={today} base="/productivity/me" />
      <StatTiles stats={plan.stats} />
      <PlanList
        tasks={plan.tasks}
        title={day === today ? "Today's Plan" : `Plan for ${dayLabel}`}
        emptyText={day === today ? 'Nothing for you today. Enjoy the quiet.' : 'Nothing planned for this day.'}
      />
      {quick && <QuickAddButton href={quick.href} label={quick.label} />}
    </div>
  );
}
