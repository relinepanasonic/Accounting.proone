// Server only. Builds the KPI numbers for ONE person. It reads with the service role (the caller has already
// checked who is asking), so a staff member always sees the full picture of their own clients, whatever the row rules say.
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getDashboardUploadLog, jakartaDay } from '@/lib/integrations/dashboard-uploads';
import { hasData, normalizeGroup, totals } from '@/lib/advertiser/report-utils';
import { nameKeys, type Person } from '@/lib/productivity/activity';
import {
  addDays,
  adSessionTarget,
  daysBetween,
  isAdminWorkday,
  monthDaysSoFar,
  monthKey,
  norm,
  todayJakarta,
  workWeek,
} from '@/lib/kpi/calendar';

type Db = ReturnType<typeof createAdminClient>;
export type KpiJob = 'advertising' | 'admin' | 'sales';

interface ClientRef {
  id: string;
  name: string;
}

// ---------- shapes the UI reads ----------
export interface Progress {
  done: number;
  due: number;
}

export interface AdvertisingKpi {
  clients: ClientRef[];
  today: string;
  target: number; // sessions per client today (2, or 3 on a twin date / payday)
  special: boolean;
  todayProgress: Progress;
  weekProgress: Progress;
  monthProgress: Progress;
  todayRows: { client: ClientRef; slots: boolean[] }[];
  series: { day: string; jual: number; biaya: number; roas: number }[];
  chartClientId: string | null; // null = all clients together
}

export interface AdminClientRow {
  client: ClientRef;
  lastUpload: string | null; // YYYY-MM-DD
  daysSince: number | null;
  doneThisWeek: boolean;
  doneToday: boolean;
  reportSent: boolean;
  matched: boolean;
}
export interface AdminKpi {
  logError: string | null;
  today: string;
  rows: AdminClientRow[];
  weekProgress: Progress;
  quotaToday: number;
  doneToday: number;
  doNext: AdminClientRow[];
  monthLabelKey: string;
  reportsProgress: Progress;
  workdaysLeft: number;
}

export interface SalesKpi {
  funnel: { leads: number; warm: number; invoices: number; closing: number; lost: number; closingValue: number; pipelineValue: number };
  ar: { total: number; overdue: number; count: number; rows: { client: string; invoice: string; outstanding: number; daysLate: number }[] };
  churn: { id: string; name: string; end: string | null; days: number | null; state: 'churned' | 'warning' | 'ok' | 'unset' }[];
}

export interface PersonKpi {
  jobs: KpiJob[];
  advertising?: AdvertisingKpi;
  admin?: AdminKpi;
  sales?: SalesKpi;
}

// ---------- who holds what ----------
export async function assignedClients(db: Db, workspaceId: string, userId: string, job: KpiJob): Promise<ClientRef[]> {
  let { data, error } = await db
    .from('client_assignments')
    .select('client_id, clients ( id, name )')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('job', job);
  if (error) {
    // The job column does not exist yet: every old assignment counts as advertising.
    if (job !== 'advertising') return [];
    ({ data } = await db.from('client_assignments').select('client_id, clients ( id, name )').eq('workspace_id', workspaceId).eq('user_id', userId));
  }
  return (data || [])
    .map((a: any) => (Array.isArray(a.clients) ? a.clients[0] : a.clients))
    .filter(Boolean)
    .map((c: any) => ({ id: c.id as string, name: String(c.name) }))
    .sort((a: ClientRef, b: ClientRef) => a.name.localeCompare(b.name));
}

export async function loadKpi(person: Person, workspaceId: string, opts: { chartClient?: string } = {}): Promise<PersonKpi> {
  const db = createAdminClient();
  const today = todayJakarta();

  const [adv, adm, sal] = await Promise.all([
    assignedClients(db, workspaceId, person.userId, 'advertising'),
    assignedClients(db, workspaceId, person.userId, 'admin'),
    assignedClients(db, workspaceId, person.userId, 'sales'),
  ]);

  const { data: deals } = await db
    .from('crm_deals')
    .select('id, client_id, lead_name, value, stage, salesman_name, created_at, updated_at')
    .eq('workspace_id', workspaceId);
  const keys = nameKeys(person);
  const myDeals = (deals || []).filter((d: any) => keys.has(String(d.salesman_name || '').trim().toLowerCase()));

  const jobs: KpiJob[] = [];
  if (person.role === 'advertiser' || adv.length > 0) jobs.push('advertising');
  if (person.role === 'admin' || adm.length > 0) jobs.push('admin');
  if (sal.length > 0 || myDeals.length > 0) jobs.push('sales');

  const out: PersonKpi = { jobs };
  if (jobs.includes('advertising')) out.advertising = await advertisingKpi(db, workspaceId, adv, today, opts.chartClient);
  if (jobs.includes('admin')) out.admin = await adminKpi(db, workspaceId, adm, today);
  if (jobs.includes('sales')) out.sales = await salesKpi(db, workspaceId, sal, myDeals, today);
  return out;
}

// ---------- advertising ----------
async function advertisingKpi(db: Db, workspaceId: string, clients: ClientRef[], today: string, chartClient?: string): Promise<AdvertisingKpi> {
  const target = adSessionTarget(today);
  const monthDays = monthDaysSoFar(today);
  const from = addDays(today, -13) < monthDays[0] ? addDays(today, -13) : monthDays[0];
  const empty: AdvertisingKpi = {
    clients, today, target, special: target === 3,
    todayProgress: { done: 0, due: clients.length * target },
    weekProgress: { done: 0, due: 0 }, monthProgress: { done: 0, due: 0 },
    todayRows: clients.map((c) => ({ client: c, slots: Array.from({ length: target }).map(() => false) })),
    series: [], chartClientId: null,
  };
  if (clients.length === 0) return empty;

  const { data: reports } = await db
    .from('advertiser_reports')
    .select('client_id, report_date, session, data_inkubasi, data_group, data_mandiri')
    .eq('workspace_id', workspaceId)
    .in('client_id', clients.map((c) => c.id))
    .gte('report_date', from)
    .lte('report_date', today)
    .limit(6000);

  const rowsOf = (r: any) => [...(r.data_inkubasi || []), ...normalizeGroup(r.data_group), ...(r.data_mandiri || [])].filter(hasData);
  const worked = (reports || []).filter((r: any) => rowsOf(r).length > 0);

  // client|day -> sessions saved
  const sessions = new Map<string, Set<number>>();
  worked.forEach((r: any) => {
    const k = `${r.client_id}|${r.report_date}`;
    if (!sessions.has(k)) sessions.set(k, new Set());
    sessions.get(k)!.add(Number(r.session));
  });

  const progress = (days: string[]): Progress => {
    let done = 0;
    let due = 0;
    for (const day of days) {
      const t = adSessionTarget(day);
      for (const c of clients) {
        due += t;
        done += Math.min(sessions.get(`${c.id}|${day}`)?.size || 0, t);
      }
    }
    return { done, due };
  };

  // Chart: the figures of a day are the running totals of the LAST session saved that day.
  const chartId = chartClient && clients.some((c) => c.id === chartClient) ? chartClient : null;
  const chartDays = Array.from({ length: 14 }).map((_, i) => addDays(today, i - 13));
  const series = chartDays.map((day) => {
    let jual = 0;
    let biaya = 0;
    for (const c of clients) {
      if (chartId && c.id !== chartId) continue;
      const last = worked
        .filter((r: any) => r.client_id === c.id && r.report_date === day)
        .sort((a: any, b: any) => Number(b.session) - Number(a.session))[0];
      if (!last) continue;
      const t = totals(rowsOf(last));
      jual += t.jual;
      biaya += t.biaya;
    }
    return { day, jual, biaya, roas: biaya > 0 ? jual / biaya : 0 };
  });

  return {
    clients, today, target, special: target === 3,
    todayProgress: progress([today]),
    weekProgress: progress(workWeekDaysUntil(today)),
    monthProgress: progress(monthDays),
    todayRows: clients.map((c) => {
      const s = sessions.get(`${c.id}|${today}`);
      return { client: c, slots: Array.from({ length: target }).map((_, i) => Boolean(s?.has(i + 1))) };
    }),
    series,
    chartClientId: chartId,
  };
}

// Advertising runs every day, so "this week" is Monday up to today.
function workWeekDaysUntil(today: string): string[] {
  const monday = workWeek(today)[0];
  const out: string[] = [];
  for (let d = monday; d <= today; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------- admin ----------
async function adminKpi(db: Db, workspaceId: string, clients: ClientRef[], today: string): Promise<AdminKpi> {
  const week = workWeek(today);
  const month = monthKey(today);
  const empty = {
    today, rows: [] as AdminClientRow[], weekProgress: { done: 0, due: 0 }, quotaToday: 0, doneToday: 0,
    doNext: [] as AdminClientRow[], monthLabelKey: month, reportsProgress: { done: 0, due: 0 }, workdaysLeft: 0,
  };

  const log = await getDashboardUploadLog(31);
  const uploads = log.ok ? log.uploads : [];

  // Which uploads belong to which client: by store or owner name.
  const lastByClient = new Map<string, string>();
  const daysByClient = new Map<string, Set<string>>();
  for (const c of clients) {
    const n = norm(c.name);
    if (!n) continue;
    const days = new Set<string>();
    for (const u of uploads) {
      const s = norm(u.store);
      const o = norm(u.owner);
      const hit = (x: string) => x && (x === n || x.includes(n) || n.includes(x));
      if (hit(s) || hit(o)) days.add(jakartaDay(new Date(u.uploadedAt)));
    }
    if (days.size) {
      daysByClient.set(c.id, days);
      lastByClient.set(c.id, Array.from(days).sort().reverse()[0]);
    }
  }

  const { data: sent } = clients.length
    ? await db.from('client_monthly_reports').select('client_id').eq('workspace_id', workspaceId).eq('month', month).in('client_id', clients.map((c) => c.id))
    : { data: [] as any[] };
  const sentIds = new Set((sent || []).map((s: any) => s.client_id));

  const rows: AdminClientRow[] = clients.map((client) => {
    const days = daysByClient.get(client.id);
    const last = lastByClient.get(client.id) || null;
    return {
      client,
      lastUpload: last,
      daysSince: last ? daysBetween(last, today) : null,
      doneThisWeek: Boolean(days && week.some((d) => days.has(d))),
      doneToday: Boolean(days?.has(today)),
      reportSent: sentIds.has(client.id),
      matched: Boolean(days),
    };
  });
  if (clients.length === 0) return { ...empty, logError: log.ok ? null : log.error };

  const workdaysLeft = week.filter((d) => d >= today && isAdminWorkday(d)).length;
  const quotaToday = Math.ceil(clients.length / 6);
  const doneToday = rows.filter((r) => r.doneToday).length;
  const pending = rows.filter((r) => !r.doneThisWeek).sort((a, b) => (b.daysSince ?? 999) - (a.daysSince ?? 999));
  const stillToDoToday = Math.max(0, quotaToday - doneToday);

  return {
    logError: log.ok ? null : log.error,
    today,
    rows,
    weekProgress: { done: rows.filter((r) => r.doneThisWeek).length, due: rows.length },
    quotaToday,
    doneToday,
    doNext: pending.slice(0, stillToDoToday),
    monthLabelKey: month,
    reportsProgress: { done: rows.filter((r) => r.reportSent).length, due: rows.length },
    workdaysLeft,
  };
}

// ---------- sales ----------
const WARM = ['Contacted', 'Negotiation'];

async function salesKpi(db: Db, workspaceId: string, assigned: ClientRef[], deals: any[], today: string): Promise<SalesKpi> {
  const month = monthKey(today);
  const funnel = { leads: 0, warm: 0, invoices: 0, closing: 0, lost: 0, closingValue: 0, pipelineValue: 0 };
  for (const d of deals) {
    const v = Number(d.value || 0);
    if (d.stage === 'Lead') funnel.leads++;
    else if (WARM.includes(d.stage)) funnel.warm++;
    else if (d.stage === 'Invoice') funnel.invoices++;
    else if (d.stage === 'Deal' || d.stage === 'Won') {
      if (String(d.updated_at || '').slice(0, 7) === month) {
        funnel.closing++;
        funnel.closingValue += v;
      }
    } else if (d.stage === 'Lost') {
      if (String(d.updated_at || '').slice(0, 7) === month) funnel.lost++;
    }
    if (d.stage !== 'Lost' && d.stage !== 'Deal' && d.stage !== 'Won' && d.stage !== 'Cold Case') funnel.pipelineValue += v;
  }

  // The clients this person looks after: assigned for Sales, plus the clients of their deals.
  const ids = new Set<string>([...assigned.map((c) => c.id), ...deals.map((d) => d.client_id).filter(Boolean)]);
  const idList = Array.from(ids);

  let clientRows: any[] = [];
  let invoices: any[] = [];
  if (idList.length) {
    const c = await db.from('clients').select('id, name, service_end_date').in('id', idList);
    // service_end_date may not exist until the KPI migration has been run
    clientRows = c.error ? ((await db.from('clients').select('id, name').in('id', idList)).data || []) : c.data || [];
    const inv = await db
      .from('invoices')
      .select('invoice_number, client_id, status, due_date, total_amount, amount_paid, is_quotation')
      .eq('workspace_id', workspaceId)
      .in('client_id', idList)
      .not('status', 'in', '(draft,cancelled,paid)');
    invoices = (inv.data || []).filter((i: any) => !i.is_quotation);
  }
  const nameById = new Map<string, string>(clientRows.map((c: any) => [c.id, String(c.name)]));

  const arRows = invoices
    .map((i: any) => ({
      client: nameById.get(i.client_id) || 'Unknown',
      invoice: String(i.invoice_number),
      outstanding: Number(i.total_amount || 0) - Number(i.amount_paid || 0),
      daysLate: i.due_date ? Math.max(0, daysBetween(String(i.due_date), today)) : 0,
    }))
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.daysLate - a.daysLate || b.outstanding - a.outstanding);

  const churn = clientRows
    .map((c: any) => {
      const end: string | null = c.service_end_date || null;
      const days = end ? daysBetween(today, end) : null;
      const state: SalesKpi['churn'][number]['state'] = days === null ? 'unset' : days < 0 ? 'churned' : days <= 30 ? 'warning' : 'ok';
      return { id: c.id as string, name: String(c.name), end, days, state };
    })
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));

  return {
    funnel,
    ar: {
      total: arRows.reduce((s, r) => s + r.outstanding, 0),
      overdue: arRows.filter((r) => r.daysLate > 0).reduce((s, r) => s + r.outstanding, 0),
      count: arRows.length,
      rows: arRows.slice(0, 6),
    },
    churn,
  };
}
