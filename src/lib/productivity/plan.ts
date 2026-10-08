// Productivity "Today's Plan": a person's real duties as a list of task cards, plus calendar markers.
// Nothing here is typed in by hand: ad sessions come from the ad reports, uploads from the dashboard log,
// deals from the pipeline, and "to do" items from the notifications. Server only.
import { createAdminClient } from '@/lib/api/supabase-admin';
import { hasData, normalizeGroup } from '@/lib/advertiser/report-utils';
import { adSessionTarget, addDays, daysBetween, monthStart, todayJakarta } from '@/lib/kpi/calendar';
import { assignedClients, loadKpi } from '@/lib/kpi/load';
import type { Person } from '@/lib/productivity/activity';
import { followUpDueDay } from '@/lib/sales/flow';

type Db = any;

export type PlanCategory = 'Advertising' | 'Admin' | 'Sales' | 'Finance' | 'Team';
export type PlanTone = 'gold' | 'sky' | 'emerald' | 'violet' | 'rose';

export const CATEGORY_TONE: Record<PlanCategory, PlanTone> = {
  Advertising: 'gold',
  Admin: 'sky',
  Sales: 'emerald',
  Finance: 'violet',
  Team: 'rose',
};

export interface PlanTask {
  id: string;
  title: string;
  subtitle: string;
  category: PlanCategory;
  done: boolean;
  urgent: boolean;
  /** e.g. 1 of 2 ad sessions */
  progress?: { done: number; total: number };
  /** one chip per ad session slot */
  slots?: boolean[];
  href: string;
  /** small note on the right, e.g. "3 days late" */
  note?: string;
}

export interface DayPlan {
  day: string;
  tasks: PlanTask[];
  stats: { total: number; done: number; pending: number; urgent: number };
}

const jakartaHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()));
const FINANCE = ['accounting', 'admin', 'superadmin', 'founder'];
const OWNERS = ['superadmin', 'founder'];

/** Ad sessions saved on one day, per client. */
async function sessionsOn(db: Db, workspaceId: string, clientIds: string[], day: string) {
  const out = new Map<string, Set<number>>();
  if (!clientIds.length) return out;
  const { data } = await db
    .from('advertiser_reports')
    .select('client_id, session, data_inkubasi, data_group, data_mandiri')
    .eq('workspace_id', workspaceId)
    .in('client_id', clientIds)
    .eq('report_date', day);
  for (const r of data || []) {
    const rows = [...(r.data_inkubasi || []), ...normalizeGroup(r.data_group), ...(r.data_mandiri || [])].filter(hasData);
    if (!rows.length) continue;
    if (!out.has(r.client_id)) out.set(r.client_id, new Set());
    out.get(r.client_id)!.add(Number(r.session));
  }
  return out;
}

/** "To do" notifications this role may act on (invoice requests, new projects, invoice ready...). */
async function notificationTasks(db: Db, workspaceId: string, userId: string, role: string): Promise<PlanTask[]> {
  const { data, error } = await db
    .from('notifications')
    .select('id, audience, user_id, kind, title, body, link, created_at')
    .eq('workspace_id', workspaceId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return [];
  return (data || [])
    .filter((n: any) => (n.audience === 'finance' && FINANCE.includes(role)) || (n.audience === 'owners' && OWNERS.includes(role)) || (n.audience === 'user' && n.user_id === userId))
    .map((n: any): PlanTask => {
      const hoursOld = (Date.now() - new Date(n.created_at).getTime()) / 3600000;
      const category: PlanCategory = n.kind === 'invoice_request' ? 'Finance' : n.kind === 'project_needs_handler' ? 'Team' : 'Sales';
      return {
        id: `n-${n.id}`,
        title: n.title,
        subtitle: n.body || '',
        category,
        done: false,
        urgent: hoursOld >= 24,
        href: n.link || '/productivity/me',
        note: hoursOld < 1 ? 'just now' : hoursOld < 24 ? `${Math.round(hoursOld)} h ago` : `${Math.round(hoursOld / 24)} d ago`,
      };
    });
}

/** A salesman's own cards that need him today. */
async function dealTasks(db: Db, workspaceId: string, userId: string): Promise<PlanTask[]> {
  const { data: deals, error } = await db.from('crm_deals').select('*').eq('workspace_id', workspaceId).eq('salesman_id', userId).neq('stage', 'Lost');
  if (error || !deals?.length) return [];
  const ids = deals.map((d: any) => d.id);
  const clientIds = Array.from(new Set(deals.map((d: any) => d.client_id).filter(Boolean)));
  const [{ data: projects }, { data: clients }, { data: invoices }] = await Promise.all([
    db.from('projects').select('deal_id').in('deal_id', ids),
    clientIds.length ? db.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] as any[] }),
    deals.some((d: any) => d.invoice_id) ? db.from('invoices').select('id, invoice_number, status').in('id', deals.map((d: any) => d.invoice_id).filter(Boolean)) : Promise.resolve({ data: [] as any[] }),
  ]);
  const hasProject = new Set((projects || []).map((p: any) => p.deal_id));
  const cName = new Map<string, string>((clients || []).map((c: any) => [c.id, c.name]));
  const inv = new Map<string, any>((invoices || []).map((i: any) => [i.id, i]));
  const tasks: PlanTask[] = [];

  const today = todayJakarta();
  for (const d of deals) {
    const client = cName.get(d.client_id) || d.lead_name || 'Client';
    if (d.stage === 'Deal' && !hasProject.has(d.id)) {
      tasks.push({ id: `d-${d.id}`, title: `Paid: ${client}`, subtitle: 'Accounting sets the project start date.', category: 'Sales', done: false, urgent: false, href: '/sales/clients' });
    } else if (d.stage === 'Invoice' && d.invoice_generated_at && !d.paid_at) {
      const i = inv.get(d.invoice_id);
      tasks.push({ id: `d-${d.id}`, title: `Send the invoice to ${client}`, subtitle: i?.invoice_number ? `${i.invoice_number} is ready to share` : 'Invoice is ready to share', category: 'Sales', done: false, urgent: false, href: '/sales/pipeline' });
    } else if (d.stage === 'Negotiation') {
      if (d.neg_acc_status === 'approved' && !d.invoice_requested_at && !d.invoice_id) {
        tasks.push({ id: `d-${d.id}`, title: `Request the invoice: ${client}`, subtitle: `ACC by ${d.neg_acc_by_name || 'an owner'}`, category: 'Sales', done: false, urgent: false, href: '/sales/pipeline' });
      } else if (d.neg_acc_status === 'rejected') {
        tasks.push({ id: `d-${d.id}`, title: `Rework the negotiation: ${client}`, subtitle: d.neg_acc_comment ? `Sent back: ${d.neg_acc_comment}` : 'ACC sent it back', category: 'Sales', done: false, urgent: true, href: '/sales/pipeline' });
      }
    } else if (d.stage === 'Lead' || d.stage === 'Contacted') {
      // Follow-up every 2 days in Lead, every week in Contacted, until the card is moved to Cold Case. The proposal is a one-time task.
      const due = followUpDueDay(d);
      if (due && due <= today) {
        const late = Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${due}T12:00:00Z`).getTime()) / 86400000);
        tasks.push({ id: `f-${d.id}`, title: `Follow up: ${client}`, subtitle: `${d.stage} · every ${d.stage === 'Lead' ? '2 days' : 'week'}`, category: 'Sales', done: false, urgent: late >= 2, href: '/sales/pipeline', note: late > 0 ? `${late} d late` : 'today' });
      }
      if (!d.proposal_sent_at) {
        tasks.push({ id: `p-${d.id}`, title: `Send the proposal: ${client}`, subtitle: `${d.stage} · one time`, category: 'Sales', done: false, urgent: false, href: '/sales/pipeline' });
      }
    }
  }
  return tasks;
}

export async function loadDayPlan(person: Person, role: string, workspaceId: string, day: string): Promise<DayPlan> {
  const db = createAdminClient();
  const today = todayJakarta();
  const isToday = day === today;
  const isPast = day < today;
  const tasks: PlanTask[] = [];

  // ---- advertising: sessions per assigned client, for any day ----
  const adClients = await assignedClients(db, workspaceId, person.userId, 'advertising');
  if (adClients.length) {
    const target = adSessionTarget(day);
    const sessions = await sessionsOn(db, workspaceId, adClients.map((c) => c.id), day);
    for (const c of adClients) {
      const set = sessions.get(c.id) || new Set<number>();
      const count = Math.min(set.size, target);
      const done = count >= target;
      tasks.push({
        id: `a-${c.id}`,
        title: c.name,
        subtitle: `Ad sessions · ${target} ${target === 3 ? '(twin date / payday)' : 'today'}`.replace('today', isToday ? 'today' : 'that day'),
        category: 'Advertising',
        done,
        urgent: !done && (isPast || (isToday && jakartaHour() >= 15)),
        progress: { done: count, total: target },
        slots: Array.from({ length: target }).map((_, i) => set.has(i + 1)),
        href: '/productivity/advertiser',
      });
    }
  }

  // ---- admin + sales duties: today only (they depend on the week and on the live pipeline) ----
  if (isToday) {
    const kpi = await loadKpi(person, workspaceId);
    if (kpi.admin && kpi.admin.rows.length) {
      const a = kpi.admin;
      for (const r of a.doNext) {
        tasks.push({
          id: `u-${r.client.id}`,
          title: r.client.name,
          subtitle: 'Upload the Shopee report (weekly)',
          category: 'Admin',
          done: false,
          urgent: r.daysSince === null || r.daysSince >= 5,
          href: '/productivity/admin',
          note: r.daysSince === null ? 'never' : `${r.daysSince} d ago`,
        });
      }
      if (a.doneToday > 0) {
        tasks.push({ id: 'u-done', title: `${a.doneToday} client${a.doneToday === 1 ? '' : 's'} uploaded`, subtitle: `Today's quota is ${a.quotaToday}`, category: 'Admin', done: a.doneToday >= a.quotaToday, urgent: false, progress: { done: a.doneToday, total: a.quotaToday }, href: '/productivity/admin' });
      }
      if (a.reportsProgress.due > 0) {
        const left = a.reportsProgress.due - a.reportsProgress.done;
        tasks.push({ id: 'u-reports', title: 'Monthly client reports', subtitle: `${a.reportsProgress.done} of ${a.reportsProgress.due} sent`, category: 'Admin', done: left === 0, urgent: left > 0 && Number(today.slice(8)) >= 25, progress: { done: a.reportsProgress.done, total: a.reportsProgress.due }, href: '/productivity/admin' });
      }
    }
    if (kpi.sales) {
      for (const r of kpi.sales.ar.rows.filter((x) => x.daysLate > 0).slice(0, 5)) {
        tasks.push({ id: `ar-${r.invoice}`, title: `Chase payment: ${r.client}`, subtitle: `${r.invoice} · Rp ${Math.round(r.outstanding).toLocaleString('id-ID')} unpaid`, category: 'Sales', done: false, urgent: true, href: '/sales/clients#ar', note: `${r.daysLate} d late` });
      }
      for (const c of kpi.sales.churn.filter((x) => x.state !== 'ok' && x.state !== 'unset').slice(0, 5)) {
        tasks.push({ id: `ch-${c.id}`, title: `${c.state === 'churned' ? 'Win back' : 'Renew'}: ${c.name}`, subtitle: c.state === 'churned' ? `Service ended ${Math.abs(c.days!)} days ago` : c.days === 0 ? 'Service ends today' : `Service ends in ${c.days} days`, category: 'Sales', done: false, urgent: c.state === 'churned', href: '/sales/clients' });
      }
    }
    if (role === 'sales' || kpi.jobs.includes('sales')) tasks.push(...(await dealTasks(db, workspaceId, person.userId)));

    // ---- anything waiting for this role: invoice requests, new projects, invoice ready ----
    tasks.push(...(await notificationTasks(db, workspaceId, person.userId, role)));
  }

  tasks.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.urgent) - Number(a.urgent));
  const done = tasks.filter((t) => t.done).length;
  return {
    day,
    tasks,
    stats: { total: tasks.length, done, pending: tasks.length - done, urgent: tasks.filter((t) => t.urgent && !t.done).length },
  };
}

// ------------------------------------------------------------------------------------------------ calendar
export interface CalendarEvent {
  title: string;
  subtitle: string;
  category: PlanCategory;
  href: string;
}

/** What happens on which day of a month: project starts / ends, service ends, special ad days, invoices due. */
export async function loadMonthEvents(person: Person, role: string, workspaceId: string, month: string, mask: (name: string | null, assigned: string | null) => string): Promise<Map<string, CalendarEvent[]>> {
  const db = createAdminClient();
  const events = new Map<string, CalendarEvent[]>();
  const add = (day: string, e: CalendarEvent) => {
    if (day.slice(0, 7) !== month) return;
    (events.get(day) || events.set(day, []).get(day)!).push(e);
  };
  const first = `${month}-01`;
  const lastDay = (() => {
    const [y, m] = month.split('-').map(Number);
    return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  })();

  const seeAll = FINANCE.includes(role) || role === 'sales';
  const [adClients, adminClients] = await Promise.all([
    assignedClients(db, workspaceId, person.userId, 'advertising'),
    assignedClients(db, workspaceId, person.userId, 'admin'),
  ]);
  const mine = new Set<string>([...adClients, ...adminClients].map((c) => c.id));

  // special ad days (3 sessions)
  if (adClients.length || role === 'advertiser') {
    for (let d = first; d <= lastDay; d = addDays(d, 1)) {
      if (adSessionTarget(d) === 3) add(d, { title: '3 ad sessions per client', subtitle: d.slice(8) === '25' ? 'Payday' : 'Twin date', category: 'Advertising', href: '/productivity/advertiser' });
    }
  }
  // the monthly client report
  if (adminClients.length || role === 'admin') add(lastDay, { title: 'Send the monthly client reports', subtitle: 'End of month', category: 'Admin', href: '/productivity/admin' });

  // projects
  const { data: projects } = await db.from('projects').select('id, client_id, name, start_date, end_date').eq('workspace_id', workspaceId);
  const clientIds = Array.from(new Set((projects || []).map((p: any) => p.client_id)));
  const { data: clients } = clientIds.length ? await db.from('clients').select('id, name').in('id', clientIds) : { data: [] as any[] };
  const cName = new Map<string, string>((clients || []).map((c: any) => [c.id, c.name]));
  for (const p of projects || []) {
    if (!seeAll && !mine.has(p.client_id)) continue;
    const name = cName.get(p.client_id) || p.name;
    add(p.start_date, { title: `Project starts: ${name}`, subtitle: p.name, category: 'Team', href: '/productivity/assignments' });
    if (p.end_date) add(p.end_date, { title: `Project ends: ${name}`, subtitle: p.name, category: 'Team', href: '/productivity/assignments' });
  }

  // invoices due (finance and sales see receivables)
  if (FINANCE.includes(role)) {
    const { data: due } = await db
      .from('invoices')
      .select('invoice_number, due_date, total_amount, amount_paid, assigned_workspace_id, clients ( name )')
      .eq('workspace_id', workspaceId)
      .eq('is_quotation', false)
      .not('status', 'in', '(draft,cancelled,paid)')
      .gte('due_date', first)
      .lte('due_date', lastDay);
    for (const i of due || []) {
      const left = Number(i.total_amount) - Number(i.amount_paid || 0);
      if (left <= 0) continue;
      const cn = mask(Array.isArray(i.clients) ? i.clients[0]?.name : (i.clients as any)?.name, i.assigned_workspace_id);
      add(i.due_date, { title: `Invoice due: ${cn}`, subtitle: `${i.invoice_number} · Rp ${Math.round(left).toLocaleString('id-ID')}`, category: 'Finance', href: '/invoices' });
    }
  }
  return events;
}

export const monthOf = (day: string) => day.slice(0, 7);
export { monthStart, daysBetween };
