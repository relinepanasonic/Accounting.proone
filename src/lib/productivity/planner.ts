// Loaders for the Productivity planner widgets: tasks, notes, lead visits, weather, deadlines. Server only.
import { createAdminClient } from '@/lib/api/supabase-admin';
import { addDays, daysBetween, todayJakarta } from '@/lib/kpi/calendar';
import { jakartaDay } from '@/lib/integrations/dashboard-uploads';

type Db = any;

const isMissing = (e: any) => e?.code === 'PGRST205' || e?.code === '42P01' || e?.code === '42703' || e?.code === 'PGRST204';
export const plannerMissing = (e: any) => isMissing(e);

// ---------------------------------------------------------------- tasks
export interface StaffTask {
  id: string;
  title: string;
  note: string | null;
  assigned_to: string;
  assigned_by: string | null;
  assignee_name: string;
  assigner_name: string;
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  starred: boolean;
  status: 'open' | 'done';
  done_at: string | null;
  created_at: string;
}

async function namesOf(db: Db, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return out;
  const { data } = await db.from('profiles').select('id, full_name, email').in('id', uniq);
  for (const p of data || []) out.set(p.id, p.full_name || String(p.email || '').split('@')[0] || 'Someone');
  return out;
}

/** One person's tasks, or (all = true) everyone's, for a superadmin's overview. */
export async function loadTasks(workspaceId: string, opts: { userId?: string; all?: boolean } = {}): Promise<{ tasks: StaffTask[]; missing: boolean }> {
  const db = createAdminClient();
  let q = db.from('staff_tasks').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(400);
  if (!opts.all && opts.userId) q = q.eq('assigned_to', opts.userId);
  const { data, error } = await q;
  if (error) return { tasks: [], missing: isMissing(error) };
  const names = await namesOf(db, (data || []).flatMap((t: any) => [t.assigned_to, t.assigned_by]));
  return {
    missing: false,
    tasks: (data || []).map((t: any) => ({
      ...t,
      assignee_name: names.get(t.assigned_to) || 'Someone',
      assigner_name: t.assigned_by ? names.get(t.assigned_by) || 'Someone' : '',
    })),
  };
}

// ---------------------------------------------------------------- notes
export interface QuickNote {
  id: string;
  content: string;
  created_at: string;
}
export async function loadNotes(workspaceId: string, userId: string): Promise<QuickNote[]> {
  const { data, error } = await createAdminClient().from('quick_notes').select('id, content, created_at').eq('workspace_id', workspaceId).eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
  return error ? [] : data || [];
}

// ---------------------------------------------------------------- lead visits
export interface LeadVisit {
  id: string;
  deal_id: string | null;
  client_name: string;
  salesman_id: string;
  salesman_name: string | null;
  agenda: string;
  visit_at: string;
  has_client_photo: boolean;
  has_receipt_photo: boolean;
}

export async function loadVisits(workspaceId: string, opts: { userId?: string; fromIso?: string; toIso?: string; limit?: number } = {}): Promise<{ visits: LeadVisit[]; missing: boolean }> {
  let q = createAdminClient()
    .from('lead_visits')
    .select('id, deal_id, client_name, salesman_id, salesman_name, agenda, visit_at, has_client_photo, has_receipt_photo')
    .eq('workspace_id', workspaceId)
    .order('visit_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.userId) q = q.eq('salesman_id', opts.userId);
  if (opts.fromIso) q = q.gte('visit_at', opts.fromIso);
  if (opts.toIso) q = q.lte('visit_at', opts.toIso);
  const { data, error } = await q;
  if (error) return { visits: [], missing: isMissing(error) };
  return { visits: data || [], missing: false };
}

export const visitDay = (iso: string) => jakartaDay(new Date(iso));
export const visitTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });

/** Leads a person may log a visit for (a salesman: his own; owners and finance: all). */
export async function loadLeadChoices(workspaceId: string, opts: { userId: string; all: boolean }) {
  const db = createAdminClient();
  let q = db.from('crm_deals').select('id, title, stage, client_id, lead_name, salesman_id').eq('workspace_id', workspaceId).neq('stage', 'Lost').order('updated_at', { ascending: false }).limit(300);
  if (!opts.all) q = q.or(`salesman_id.eq.${opts.userId},salesman_id.is.null`);
  const { data } = await q;
  const ids = Array.from(new Set((data || []).map((d: any) => d.client_id).filter(Boolean)));
  const { data: clients } = ids.length ? await db.from('clients').select('id, name').in('id', ids) : { data: [] as any[] };
  const name = new Map<string, string>((clients || []).map((c: any) => [c.id, c.name]));
  return (data || []).map((d: any) => ({ id: d.id as string, client: name.get(d.client_id) || d.lead_name || 'Client', title: d.title as string, stage: d.stage as string }));
}

// ---------------------------------------------------------------- weather (Open-Meteo, no key)
export interface Weather {
  city: string;
  temp: number;
  code: number;
  hi: number;
  lo: number;
  days: { day: string; code: number; hi: number }[];
}

const CITY = { name: 'Surabaya', lat: -7.2575, lon: 112.7521 };

export async function loadWeather(): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CITY.lat}&longitude=${CITY.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FJakarta&forecast_days=4`;
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      city: CITY.name,
      temp: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      hi: Math.round(j.daily.temperature_2m_max[0]),
      lo: Math.round(j.daily.temperature_2m_min[0]),
      days: [1, 2, 3].map((i) => ({ day: j.daily.time[i], code: j.daily.weather_code[i], hi: Math.round(j.daily.temperature_2m_max[i]) })),
    };
  } catch {
    return null;
  }
}

/** WMO weather code -> words. */
export const weatherWords = (code: number) =>
  code === 0 ? 'Clear' : code <= 2 ? 'Partly cloudy' : code === 3 ? 'Cloudy' : code <= 48 ? 'Foggy' : code <= 57 ? 'Drizzle' : code <= 67 ? 'Rain' : code <= 77 ? 'Snow' : code <= 82 ? 'Showers' : code <= 86 ? 'Snow showers' : 'Thunderstorm';

// ---------------------------------------------------------------- deadlines
export interface Deadline {
  id: string;
  title: string;
  subtitle: string;
  due: string; // YYYY-MM-DD
  daysLeft: number;
  priority: 'high' | 'medium' | 'low';
  kind: 'task' | 'project';
  href: string;
}

const priorityFor = (daysLeft: number): Deadline['priority'] => (daysLeft <= 2 ? 'high' : daysLeft <= 7 ? 'medium' : 'low');

/** What is due soon: open tasks with a due date, and project end dates. */
export async function loadDeadlines(workspaceId: string, userId: string, tasks: StaffTask[], seeProjects: boolean, mineClientIds: Set<string> | null): Promise<Deadline[]> {
  const today = todayJakarta();
  const horizon = addDays(today, 30);
  const out: Deadline[] = [];

  for (const t of tasks) {
    if (t.status !== 'open' || !t.due_date || t.assigned_to !== userId || t.due_date > horizon) continue;
    const left = daysBetween(today, t.due_date);
    out.push({ id: `t-${t.id}`, title: t.title, subtitle: left < 0 ? `${-left} day${left === -1 ? '' : 's'} late` : left === 0 ? 'Due today' : `Due in ${left} day${left === 1 ? '' : 's'}`, due: t.due_date, daysLeft: left, priority: t.priority === 'high' || left <= 2 ? 'high' : t.priority === 'medium' ? priorityFor(left) : 'low', kind: 'task', href: '/productivity/tasks' });
  }

  const db = createAdminClient();
  const { data: projects } = await db.from('projects').select('id, client_id, name, end_date').eq('workspace_id', workspaceId).not('end_date', 'is', null).gte('end_date', today).lte('end_date', horizon);
  if (projects?.length) {
    const ids = Array.from(new Set(projects.map((p: any) => p.client_id)));
    const { data: clients } = await db.from('clients').select('id, name').in('id', ids);
    const cn = new Map<string, string>((clients || []).map((c: any) => [c.id, c.name]));
    for (const p of projects) {
      if (!seeProjects && !(mineClientIds && mineClientIds.has(p.client_id))) continue;
      const left = daysBetween(today, p.end_date);
      out.push({ id: `p-${p.id}`, title: `Project ends: ${cn.get(p.client_id) || p.name}`, subtitle: left === 0 ? 'Ends today' : `Due in ${left} day${left === 1 ? '' : 's'} · ${p.end_date}`, due: p.end_date, daysLeft: left, priority: priorityFor(left), kind: 'project', href: '/productivity/meetings' });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 6);
}
