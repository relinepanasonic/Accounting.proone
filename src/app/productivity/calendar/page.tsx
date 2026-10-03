import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { loadPeople, type Person } from '@/lib/productivity/activity';
import { loadDayPlan, loadMonthEvents } from '@/lib/productivity/plan';
import { todayJakarta } from '@/lib/kpi/calendar';
import { MonthGrid, PlanHeader } from '@/components/productivity/PlanViews';
import { EventCard, PlanCard } from '@/components/productivity/PlanList';
import { ProductivityTabs } from '@/components/productivity/ProductivityTabs';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId) redirect('/login');

  const today = todayJakarta();
  const sp = await searchParams;
  const valid = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : undefined);
  const date = valid(sp.date, /^\d{4}-\d{2}-\d{2}$/);
  const month = valid(sp.month, /^\d{4}-\d{2}$/) || date?.slice(0, 7) || today.slice(0, 7);
  const selected = date && date.slice(0, 7) === month ? date : month === today.slice(0, 7) ? today : `${month}-01`;

  let person: Person | undefined = (await loadPeople(supabase, ctx.activeWorkspaceId, ctx.userId))[0];
  if (!person) person = { userId: ctx.userId, name: ctx.userName || 'Me', email: ctx.userEmail || '', role: ctx.role };

  const mask = clientMask({ userEmail: ctx.userEmail, availableWorkspaces: ctx.availableWorkspaces });
  const isOwner = ctx.role === 'founder' || ctx.role === 'superadmin';
  const [events, plan] = await Promise.all([
    loadMonthEvents(person, ctx.role, ctx.activeWorkspaceId, month, (name, assigned) => mask.name(name, assigned)),
    // For a past or future day the plan holds the ad sessions; for today it also holds everything else.
    loadDayPlan(person, ctx.role, ctx.activeWorkspaceId, selected),
  ]);

  const dayEvents = events.get(selected) || [];
  const label = new Date(`${selected}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-28 animate-in fade-in duration-300">
      <PlanHeader name={person.name} subtitle="Plan ahead, stay organised" />
      <ProductivityTabs isOwner={isOwner} />
      <MonthGrid month={month} selected={selected} today={today} marked={new Set(events.keys())} base="/productivity/calendar" />

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-extrabold text-zinc-100">{label}</h2>
        {dayEvents.length === 0 && plan.tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">Nothing on this day.</div>
        )}
        {dayEvents.map((e, i) => <EventCard key={i} event={e} />)}
        {plan.tasks.map((t) => <PlanCard key={t.id} task={t} />)}
      </section>
    </div>
  );
}
