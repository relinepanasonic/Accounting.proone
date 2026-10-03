'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

type Result<T = {}> = ({ success: true } & T) | { success: false; error: string };

const OWNERS = ['superadmin', 'founder'];
const SALES_ROLES = ['sales', 'accounting', 'admin', 'superadmin', 'founder'];
const MIGRATION_HINT = 'Run supabase/migrations/20261004_planner.sql in Supabase first.';
const isMissing = (e: any) => e?.code === 'PGRST205' || e?.code === '42P01' || e?.code === '42703' || e?.code === 'PGRST204';
const fail = (e: any): { success: false; error: string } => ({ success: false, error: isMissing(e) ? MIGRATION_HINT : e?.message || 'Something went wrong.' });
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

async function actor() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || !ctx.activeWorkspaceId || ctx.role === 'none') return null;
  return { ctx, db: createAdminClient() };
}

function refresh() {
  for (const p of ['/productivity/me', '/productivity/tasks', '/productivity/meetings']) revalidatePath(p);
}

// ------------------------------------------------------------------------------------------------ tasks
export async function addTask(input: { title: string; note?: string; due_date?: string; priority?: string; assigned_to?: string }): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not signed in.' };
  const { ctx, db } = a;
  const title = str(input.title, 160);
  if (!title) return { success: false, error: 'Write the task.' };

  // Only a superadmin may give a task to someone else.
  let assignee = ctx.userId!;
  if (input.assigned_to && input.assigned_to !== ctx.userId) {
    if (!OWNERS.includes(ctx.role)) return { success: false, error: 'Only a superadmin can assign a task to someone else.' };
    const { data: m } = await db.from('workspace_members').select('user_id').eq('workspace_id', ctx.activeWorkspaceId).eq('user_id', input.assigned_to).maybeSingle();
    if (!m) return { success: false, error: 'That person is not in this workspace.' };
    assignee = input.assigned_to;
  }
  const due = input.due_date && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date) ? input.due_date : null;
  const priority = ['high', 'medium', 'low'].includes(input.priority || '') ? input.priority : 'medium';

  const { error } = await db.from('staff_tasks').insert({
    workspace_id: ctx.activeWorkspaceId, title, note: str(input.note, 600) || null, assigned_to: assignee, assigned_by: ctx.userId, due_date: due, priority,
  });
  if (error) return fail(error);

  if (assignee !== ctx.userId) {
    // Tell the person (shows in their bell and their plan).
    const { notify } = await import('@/lib/sales/server');
    await notify(db, { workspaceId: ctx.activeWorkspaceId, audience: 'user', userId: assignee, kind: 'task_assigned', title: `New task from ${ctx.userName || 'your lead'}: ${title}`, body: due ? `Due ${due}` : undefined, link: '/productivity/tasks' });
  }
  refresh();
  return { success: true };
}

async function mayEdit(db: any, ctx: any, id: string) {
  const { data: t } = await db.from('staff_tasks').select('id, assigned_to, assigned_by').eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!t) return { ok: false as const, error: 'Task not found.' };
  const mine = t.assigned_to === ctx.userId;
  const made = t.assigned_by === ctx.userId;
  return { ok: mine || made || OWNERS.includes(ctx.role), t, canDelete: made || OWNERS.includes(ctx.role) || (mine && !t.assigned_by) } as any;
}

export async function setTaskDone(id: string, done: boolean): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not signed in.' };
  const g = await mayEdit(a.db, a.ctx, id);
  if (!g.ok) return { success: false, error: g.error || 'Not allowed.' };
  const { error } = await a.db.from('staff_tasks').update({ status: done ? 'done' : 'open', done_at: done ? new Date().toISOString() : null }).eq('id', id);
  if (error) return fail(error);
  refresh();
  return { success: true };
}

export async function setTaskStar(id: string, starred: boolean): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not signed in.' };
  const g = await mayEdit(a.db, a.ctx, id);
  if (!g.ok) return { success: false, error: g.error || 'Not allowed.' };
  const { error } = await a.db.from('staff_tasks').update({ starred }).eq('id', id);
  if (error) return fail(error);
  refresh();
  return { success: true };
}

export async function deleteTask(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not signed in.' };
  const g = await mayEdit(a.db, a.ctx, id);
  if (!g.ok || !g.canDelete) return { success: false, error: 'Only who made the task, or a superadmin, can delete it.' };
  const { error } = await a.db.from('staff_tasks').delete().eq('id', id);
  if (error) return fail(error);
  refresh();
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ notes
export async function addNote(content: string): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not signed in.' };
  const text = str(content, 400);
  if (!text) return { success: false, error: 'Write a note.' };
  const { error } = await a.db.from('quick_notes').insert({ workspace_id: a.ctx.activeWorkspaceId, user_id: a.ctx.userId, content: text });
  if (error) return fail(error);
  refresh();
  return { success: true };
}

export async function deleteNote(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not signed in.' };
  const { error } = await a.db.from('quick_notes').delete().eq('id', id).eq('user_id', a.ctx.userId).eq('workspace_id', a.ctx.activeWorkspaceId);
  if (error) return fail(error);
  refresh();
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ lead visits
const MAX_PHOTO_CHARS = 1_400_000; // about 1 MB of image data after the browser has shrunk it
const isJpegDataUrl = (v: unknown): v is string => typeof v === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_PHOTO_CHARS;

export async function createVisit(input: { deal_id: string; agenda: string; visit_at: string; client_photo?: string | null; receipt_photo?: string | null }): Promise<Result> {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { success: false, error: 'Not allowed.' };
  const { ctx, db } = a;

  const agenda = str(input.agenda, 1200);
  if (!agenda) return { success: false, error: 'Write the agenda of the meeting.' };
  const when = new Date(input.visit_at);
  if (!input.visit_at || isNaN(when.getTime())) return { success: false, error: 'Choose the date and time.' };

  const { data: deal } = await db.from('crm_deals').select('id, client_id, lead_name, salesman_id').eq('id', input.deal_id).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!deal) return { success: false, error: 'Choose a lead from the list.' };
  if (ctx.role === 'sales' && deal.salesman_id && deal.salesman_id !== ctx.userId) return { success: false, error: 'This lead belongs to another salesman.' };

  // A meeting that already happened needs both photos; a future one is just a plan.
  const happened = when.getTime() <= Date.now() + 5 * 60000;
  const cp = input.client_photo || null;
  const rp = input.receipt_photo || null;
  if ((cp && !isJpegDataUrl(cp)) || (rp && !isJpegDataUrl(rp))) return { success: false, error: 'A photo could not be read. Take it again.' };
  if (happened && (!cp || !rp)) return { success: false, error: 'Take both photos: you with the client, and the receipt.' };

  const { data: client } = deal.client_id ? await db.from('clients').select('name').eq('id', deal.client_id).maybeSingle() : { data: null as any };
  const { data: me } = await db.from('profiles').select('full_name, email').eq('id', ctx.userId).maybeSingle();

  const { error } = await db.from('lead_visits').insert({
    workspace_id: ctx.activeWorkspaceId,
    deal_id: deal.id,
    client_id: deal.client_id || null,
    client_name: client?.name || deal.lead_name || 'Client',
    salesman_id: ctx.userId,
    salesman_name: me?.full_name || me?.email?.split('@')[0] || ctx.userName || null,
    agenda,
    visit_at: when.toISOString(),
    client_photo: cp,
    receipt_photo: rp,
    has_client_photo: Boolean(cp),
    has_receipt_photo: Boolean(rp),
  });
  if (error) return fail(error);

  await db.from('crm_deals').update({ updated_at: new Date().toISOString() }).eq('id', deal.id); // the lead was worked on: it is no longer "idle"
  refresh();
  return { success: true };
}

export async function deleteVisit(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not signed in.' };
  const { ctx, db } = a;
  const { data: v } = await db.from('lead_visits').select('id, salesman_id').eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!v) return { success: false, error: 'Visit not found.' };
  if (v.salesman_id !== ctx.userId && !OWNERS.includes(ctx.role)) return { success: false, error: 'Only who logged it, or a superadmin, can delete it.' };
  const { error } = await db.from('lead_visits').delete().eq('id', id);
  if (error) return fail(error);
  refresh();
  return { success: true };
}
