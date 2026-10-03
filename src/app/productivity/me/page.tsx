import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { loadPeople, type Person } from '@/lib/productivity/activity';
import { loadDayPlan, loadMonthEvents } from '@/lib/productivity/plan';
import { loadDeadlines, loadLeadChoices, loadNotes, loadTasks, loadVisits, loadWeather, visitDay, visitTime } from '@/lib/productivity/planner';
import { assignedClients } from '@/lib/kpi/load';
import { addDays, todayJakarta } from '@/lib/kpi/calendar';
import { MonthGrid, StatTiles } from '@/components/productivity/PlanViews';
import { PlanList } from '@/components/productivity/PlanList';
import { ProductivityTabs } from '@/components/productivity/ProductivityTabs';
import { ClockHeader } from '@/components/productivity/today/ClockHeader';
import { FocusTimer } from '@/components/productivity/today/FocusTimer';
import { NotesWidget } from '@/components/productivity/today/NotesWidget';
import { TasksWidget } from '@/components/productivity/today/TasksWidget';
import { PictureWithLeads } from '@/components/productivity/today/PictureWithLeads';
import { DeadlinesWidget, ScheduleWidget, WeatherWidget, Widget, type ScheduleItem } from '@/components/productivity/today/Widgets';

export const dynamic = 'force-dynamic';

const SALES_ROLES = ['sales', 'accounting', 'admin', 'superadmin', 'founder'];
const SEE_PROJECTS = ['sales', 'accounting', 'admin', 'superadmin', 'founder'];

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string; month?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId) redirect('/login');

  const today = todayJakarta();
  const sp = await searchParams;
  const valid = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : undefined);
  const date = valid(sp.date, /^\d{4}-\d{2}-\d{2}$/);
  const month = valid(sp.month, /^\d{4}-\d{2}$/) || date?.slice(0, 7) || today.slice(0, 7);
  const selected = date && date.slice(0, 7) === month ? date : month === today.slice(0, 7) ? today : `${month}-01`;

  // Always the signed-in person: nothing in the address can show someone else here.
  let person: Person | undefined = (await loadPeople(supabase, ctx.activeWorkspaceId, ctx.userId))[0];
  if (!person) person = { userId: ctx.userId, name: ctx.userName || 'Me', email: ctx.userEmail || '', role: ctx.role };

  const ws = ctx.activeWorkspaceId;
  const mask = clientMask({ userEmail: ctx.userEmail, availableWorkspaces: ctx.availableWorkspaces });
  const canVisit = SALES_ROLES.includes(ctx.role);
  const lastDay = `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()).padStart(2, '0')}`;

  const db = createAdminClient();
  const [plan, events, visitsRes, tasksRes, notes, weather, leads, adClients, adminClients] = await Promise.all([
    loadDayPlan(person, ctx.role, ws, selected),
    loadMonthEvents(person, ctx.role, ws, month, (name, assigned) => mask.name(name, assigned)),
    loadVisits(ws, { userId: ctx.role === 'sales' ? ctx.userId : undefined, fromIso: `${month}-01T00:00:00+07:00`, toIso: `${addDays(lastDay, 1)}T00:00:00+07:00`, limit: 300 }),
    loadTasks(ws, { userId: ctx.userId }),
    loadNotes(ws, ctx.userId),
    loadWeather(),
    canVisit ? loadLeadChoices(ws, { userId: ctx.userId, all: ctx.role !== 'sales' }) : Promise.resolve([]),
    assignedClients(db, ws, ctx.userId, 'advertising'),
    assignedClients(db, ws, ctx.userId, 'admin'),
  ]);

  const mine = new Set<string>([...adClients, ...adminClients].map((c) => c.id));
  const deadlines = await loadDeadlines(ws, ctx.userId, tasksRes.tasks, SEE_PROJECTS.includes(ctx.role), mine);

  // Today's Schedule: the meetings of the chosen day, then all-day items (project starts, report deadlines...).
  const dayVisits = visitsRes.visits.filter((v) => visitDay(v.visit_at) === selected).sort((a, b) => a.visit_at.localeCompare(b.visit_at));
  const schedule: ScheduleItem[] = [
    ...dayVisits.map((v): ScheduleItem => ({
      key: `v-${v.id}`,
      time: visitTime(v.visit_at),
      title: v.client_name,
      subtitle: ctx.role === 'sales' ? v.agenda : `${v.salesman_name || 'Sales'} · ${v.agenda}`,
      tone: new Date(v.visit_at).getTime() > Date.now() ? 'sky' : 'gold',
      href: '/productivity/meetings',
    })),
    ...(events.get(selected) || []).map((e, i): ScheduleItem => ({ key: `e-${i}`, time: null, title: e.title, subtitle: e.subtitle, tone: e.category === 'Advertising' ? 'gold' : e.category === 'Admin' ? 'sky' : e.category === 'Finance' ? 'violet' : e.category === 'Sales' ? 'emerald' : 'rose', href: e.href })),
  ];
  const marked = new Set<string>([...events.keys(), ...visitsRes.visits.map((v) => visitDay(v.visit_at))]);
  const dayLabel = selected === today ? 'Today' : new Date(`${selected}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const dutiesTitle = selected === today ? "Today's Duties" : `Duties · ${dayLabel}`;
  const setupNeeded = tasksRes.missing || visitsRes.missing;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 pb-28 animate-in fade-in duration-300">
      <ClockHeader name={person.name} tagline="Focus · Plan · Execute · Succeed" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProductivityTabs />
        {canVisit && <PictureWithLeads leads={leads} />}
      </div>

      {setupNeeded && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Tasks, notes and meetings need one database step: run <span className="font-mono">supabase/migrations/20261004_planner.sql</span> in Supabase.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-4"><MonthGrid month={month} selected={selected} today={today} marked={marked} base="/productivity/me" /></div>
        <div className="lg:col-span-4"><ScheduleWidget items={schedule} dayLabel={dayLabel} /></div>
        <div className="lg:col-span-4"><WeatherWidget weather={weather} /></div>

        <Widget className="lg:col-span-7"><TasksWidget tasks={tasksRes.tasks} today={today} compact /></Widget>
        <Widget className="lg:col-span-5"><FocusTimer /></Widget>

        <Widget title={dutiesTitle} className="lg:col-span-12">
          <div className="mb-4"><StatTiles stats={plan.stats} /></div>
          <PlanList tasks={plan.tasks} title="" emptyText={selected === today ? 'Nothing for you today. Enjoy the quiet.' : 'Nothing planned for this day.'} />
        </Widget>

        <div className="lg:col-span-7"><DeadlinesWidget items={deadlines} /></div>
        <Widget className="lg:col-span-5"><NotesWidget notes={notes} /></Widget>
      </div>
    </div>
  );
}
