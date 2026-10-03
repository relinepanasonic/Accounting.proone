import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadPeople } from '@/lib/productivity/activity';
import { loadTasks } from '@/lib/productivity/planner';
import { todayJakarta } from '@/lib/kpi/calendar';
import { ProductivityTabs } from '@/components/productivity/ProductivityTabs';
import { TasksWidget } from '@/components/productivity/today/TasksWidget';
import { AssignTaskForm, TeamTasks } from '@/components/productivity/today/TaskAdmin';
import { Widget } from '@/components/productivity/today/Widgets';

export const dynamic = 'force-dynamic';

export default async function TaskListPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId) redirect('/login');

  const isOwner = ctx.role === 'founder' || ctx.role === 'superadmin';
  const today = todayJakarta();
  const ws = ctx.activeWorkspaceId;

  const [mine, all, people, waiting] = await Promise.all([
    loadTasks(ws, { userId: ctx.userId }),
    isOwner ? loadTasks(ws, { all: true }) : Promise.resolve({ tasks: [], missing: false }),
    isOwner ? loadPeople(supabase, ws) : Promise.resolve([]),
    isOwner
      ? createAdminClient().from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).is('handler_assigned_at', null)
      : Promise.resolve({ count: 0 }),
  ]);
  const staff = people.map((p) => ({ id: p.userId, name: p.name, role: p.role }));
  const projectsWaiting = (waiting as any).count || 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 pb-28 animate-in fade-in duration-300">
      <div>
        <h1 className="font-serif text-3xl font-extrabold text-zinc-100">Task List &amp; Assignment</h1>
        <p className="mt-1 text-sm text-zinc-500">{isOwner ? 'Your tasks, the tasks you gave to the team, and who handles which client.' : 'Your tasks, including the ones your lead gave you.'}</p>
      </div>
      <ProductivityTabs />

      {(mine.missing || all.missing) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Tasks need one database step: run <span className="font-mono">supabase/migrations/20261004_planner.sql</span> in Supabase.
        </div>
      )}

      <Widget><TasksWidget tasks={mine.tasks} today={today} /></Widget>

      {isOwner && (
        <>
          <Widget title="Give a task to someone"><AssignTaskForm staff={staff} meId={ctx.userId} /></Widget>
          <Widget title="Everyone's tasks"><TeamTasks tasks={all.tasks} today={today} /></Widget>
          <Link href="/productivity/assignments" className="group flex items-center justify-between gap-4 rounded-3xl border border-[#d4af37]/25 bg-[#d4af37]/5 p-5 hover:border-[#d4af37]/60">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d4af37]/15 text-[#f5d77f]"><Users className="h-5 w-5" /></span>
              <div>
                <div className="font-bold text-zinc-100">Client assignments</div>
                <div className="text-xs text-zinc-500">Choose which advertiser and admin handles each client{projectsWaiting > 0 ? ` · ${projectsWaiting} new project${projectsWaiting === 1 ? '' : 's'} waiting` : ''}</div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-[#f5d77f]" />
          </Link>
        </>
      )}
    </div>
  );
}
