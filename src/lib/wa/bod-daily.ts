import { createAdminClient } from '@/lib/api/supabase-admin';
import { adminSection, addDays, dayOf, inRange, planReport } from '@/lib/reports/whatsapp-report';
import { inputByDay, type InputReport } from '@/lib/advertiser/input-series';

/**
 * The daily BOD report (Nico and Herlan), as data for a 3-section PDF:
 *   1. Advertising: which sessions the advertisers already inputted yesterday, and one row per client store with Sales, Ads Cost and ROAS,
 *      each with its last 7 days as a small line.
 *   2. Admin: who uploaded which client's files yesterday, who is still pending, and the Friends Order (FO) projects.
 *   3. Sales: the pipeline (Lead, Contacted, Negotiation, Invoice, Deal, Cold Case) per salesperson, with a chart.
 * Pure functions first (tested), then the loader that reads the database.
 *
 * Which day the advertising numbers are about: the advertisers' Session 1 holds the Sales and Ads Cost of the day BEFORE it (Shopee's closed day),
 * so the Session 1 inputted yesterday carries the numbers of the day before yesterday. That is the latest day whose numbers are complete when the report goes out.
 */

export const STAGES = ['Lead', 'Contacted', 'Negotiation', 'Invoice', 'Deal', 'Cold Case'] as const;
export const SPARK_DAYS = 7;

// ---------------------------------------------------------------- advertising

export interface AdRow {
  client: string; store: string;
  sales: number; cost: number; roas: number;
  salesSeries: number[]; costSeries: number[]; roasSeries: number[];       // SPARK_DAYS values, oldest first, ending on the numbers day
  salesTrend: number | null; costTrend: number | null; roasTrend: number | null;    // % against the day before; null when there is nothing to compare
}

const pct = (now: number, before: number): number | null => (before > 0 ? ((now - before) / before) * 100 : null);

/**
 * One row per client + store from the advertisers' inputs. `dataDay` is the day the numbers are about (the day before the session-1 day).
 * A store with no numbers at all in the 7 days is left out. Sorted by Sales, biggest first.
 */
export function advertisingRows(reports: Array<InputReport & { store_label?: string | null }>, clientNames: Map<string, string>, dataDay: string): AdRow[] {
  const groups = new Map<string, { client: string; store: string; reports: InputReport[] }>();
  for (const r of reports) {
    const store = String(r.store_label || '').trim();
    const key = `${r.client_id}|${store}`;
    const g = groups.get(key) || { client: clientNames.get(r.client_id) || 'Client', store, reports: [] };
    g.reports.push({ ...r, client_id: key });
    groups.set(key, g);
  }
  const days = Array.from({ length: SPARK_DAYS }, (_, i) => addDays(dataDay, i - (SPARK_DAYS - 1)));
  const rows: AdRow[] = [];
  for (const [key, g] of groups) {
    const byDay = inputByDay(g.reports).get(key) || new Map();
    const salesSeries = days.map((d) => byDay.get(d)?.penjualan ?? 0);
    const costSeries = days.map((d) => byDay.get(d)?.biaya ?? 0);
    if (salesSeries.every((v) => v === 0) && costSeries.every((v) => v === 0)) continue;
    const roasSeries = days.map((_, i) => (costSeries[i] > 0 ? salesSeries[i] / costSeries[i] : 0));
    const last = SPARK_DAYS - 1;
    rows.push({
      client: g.client, store: g.store,
      sales: salesSeries[last], cost: costSeries[last], roas: roasSeries[last],
      salesSeries, costSeries, roasSeries,
      salesTrend: pct(salesSeries[last], salesSeries[last - 1]),
      costTrend: pct(costSeries[last], costSeries[last - 1]),
      roasTrend: pct(roasSeries[last], roasSeries[last - 1]),
    });
  }
  return rows.sort((a, b) => b.sales - a.sales || a.client.localeCompare(b.client));
}

export interface SessionStatus { clients: number; s1: number; s2: number; s3: number }

/** How many of the clients with an advertiser have inputted session 1, 2 and 3 on `day`. */
export function sessionStatus(reports: Array<{ client_id: string; report_date: string; session: number }>, assignedClients: string[], day: string): SessionStatus {
  const mine = new Set(assignedClients);
  const done = (s: number) => new Set(reports.filter((r) => String(r.report_date).slice(0, 10) === day && Number(r.session) === s && mine.has(r.client_id)).map((r) => r.client_id)).size;
  return { clients: mine.size, s1: done(1), s2: done(2), s3: done(3) };
}

export interface AdTotals { sales: number; cost: number; roas: number; salesSeries: number[]; costSeries: number[]; roasSeries: number[] }
export function adTotals(rows: AdRow[]): AdTotals {
  const salesSeries = Array.from({ length: SPARK_DAYS }, (_, i) => rows.reduce((s, r) => s + r.salesSeries[i], 0));
  const costSeries = Array.from({ length: SPARK_DAYS }, (_, i) => rows.reduce((s, r) => s + r.costSeries[i], 0));
  const roasSeries = costSeries.map((c, i) => (c > 0 ? salesSeries[i] / c : 0));
  const last = SPARK_DAYS - 1;
  return { sales: salesSeries[last], cost: costSeries[last], roas: roasSeries[last], salesSeries, costSeries, roasSeries };
}

// ---------------------------------------------------------------- sales pipeline

export interface PipelineSales { name: string; counts: Record<string, number>; total: number; newOnDay: number; movedOnDay: number }
export interface Pipeline { stages: Array<{ stage: string; count: number; value: number }>; bySales: PipelineSales[]; total: number; newOnDay: number; movedOnDay: number }

export function pipelineOf(deals: Array<{ salesman_name?: string | null; stage?: string | null; value?: number | string | null; created_at?: string | null; stage_changed_at?: string | null }>, day: string): Pipeline {
  const known = new Set<string>(STAGES);
  const stages = STAGES.map((s) => ({ stage: s as string, count: 0, value: 0 }));
  const by = new Map<string, PipelineSales>();
  let newOnDay = 0; let movedOnDay = 0;
  for (const d of deals) {
    const stage = known.has(String(d.stage)) ? String(d.stage) : 'Lead';
    const st = stages.find((x) => x.stage === stage)!;
    st.count++; st.value += Number(d.value || 0);
    const name = String(d.salesman_name || '').trim() || 'Tanpa sales';
    const p = by.get(name) || { name, counts: Object.fromEntries(STAGES.map((s) => [s, 0])), total: 0, newOnDay: 0, movedOnDay: 0 };
    p.counts[stage]++; p.total++;
    const created = inRange(dayOf(d.created_at), day, day);
    const moved = !created && inRange(dayOf(d.stage_changed_at), day, day);
    if (created) { p.newOnDay++; newOnDay++; }
    if (moved) { p.movedOnDay++; movedOnDay++; }
    by.set(name, p);
  }
  return { stages, bySales: Array.from(by.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)), total: deals.length, newOnDay, movedOnDay };
}

// ---------------------------------------------------------------- the whole report

export interface BodDaily {
  reportDay: string;          // "yesterday": the day the sessions and uploads are about
  dataDay: string;            // the day the Sales / Ads Cost numbers are about
  sessions: SessionStatus;
  advertisers: Array<{ name: string } & SessionStatus>;
  ads: AdRow[];
  totals: AdTotals;
  admin: { lines: Array<{ name: string; files: number; total: number; uploaded: number; uploadedNames: string[]; pendingNames: string[] }>; errors: string[]; fo: { startedOnDay: string[]; ongoing: number } };
  pipeline: Pipeline;
}

/** Reads everything the daily BOD PDF shows. `today` is the Jakarta day the report is made on (it reports on yesterday). */
export async function loadBodDaily(today: string): Promise<BodDaily | null> {
  const plan = planReport(today);
  if (plan.kind !== 'daily') return null;
  const reportDay = plan.from;
  const dataDay = addDays(reportDay, -1);
  const db = createAdminClient();

  const [{ data: reps }, { data: asg }, { data: clients }, { data: deals }, { data: fo }, admin] = await Promise.all([
    db.from('advertiser_reports').select('client_id, report_date, session, store_label, data_inkubasi, data_group, data_mandiri').gte('report_date', addDays(reportDay, -SPARK_DAYS)).lte('report_date', reportDay).limit(8000),
    db.from('client_assignments').select('client_id, user_id').eq('job', 'advertising'),
    db.from('clients').select('id, name'),
    db.from('crm_deals').select('salesman_name, stage, value, created_at, stage_changed_at'),
    db.from('fake_order_projects').select('client_name, start_date, finished_at'),
    adminSection(db, plan, today).catch(() => null),
  ]);
  const reports = (reps || []).map((r: any) => ({ ...r, report_date: String(r.report_date).slice(0, 10) })) as Array<InputReport & { store_label?: string | null }>;
  const names = new Map<string, string>((clients || []).map((c: any) => [c.id as string, String(c.name || 'Client')]));

  const userIds = Array.from(new Set((asg || []).map((a: any) => a.user_id as string)));
  const { data: profs } = userIds.length ? await db.from('profiles').select('id, full_name').in('id', userIds) : { data: [] as any[] };
  const advertisers = userIds.map((uid) => ({
    name: String((profs || []).find((p: any) => p.id === uid)?.full_name || 'Advertiser'),
    ...sessionStatus(reports, (asg || []).filter((a: any) => a.user_id === uid).map((a: any) => a.client_id as string), reportDay),
  })).sort((a, b) => a.name.localeCompare(b.name));
  const allAssigned = Array.from(new Set((asg || []).map((a: any) => a.client_id as string)));

  const ads = advertisingRows(reports, names, dataDay);
  return {
    reportDay, dataDay,
    sessions: sessionStatus(reports, allAssigned, reportDay),
    advertisers, ads, totals: adTotals(ads),
    admin: {
      lines: (admin?.lines || []).map((l: any) => ({ name: l.name, files: l.files, total: l.total, uploaded: l.uploaded, uploadedNames: l.uploadedNames || [], pendingNames: l.pendingNames || [] })),
      errors: admin?.errors || [],
      fo: {
        startedOnDay: (fo || []).filter((f: any) => String(f.start_date || '').slice(0, 10) === reportDay).map((f: any) => String(f.client_name || 'Client')),
        ongoing: (fo || []).filter((f: any) => !f.finished_at).length,
      },
    },
    pipeline: pipelineOf(deals || [], reportDay),
  };
}
