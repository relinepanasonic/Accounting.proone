import { PIPELINE_STAGES, stageIndex, stageLabel } from '@/lib/sales/flow';

/**
 * The sales page of the daily BOD report, built around the pipeline (New Lead to Active Client): what moved today, where the funnel stands and
 * how well it converts, each salesperson, and what needs attention. Pure (rows in, figures out), so the rules are tested; the loader is in bod-daily.ts.
 * All days are Jakarta days (YYYY-MM-DD).
 */
export interface SalesDeal {
  id: string; client?: string | null; salesman_name?: string | null; stage?: string | null; value?: number | string | null;
  created_at?: string | null; stage_changed_at?: string | null; proposal_sent_at?: string | null; invoice_requested_at?: string | null;
  invoice_generated_at?: string | null; paid_at?: string | null; acc_approved_at?: string | null;
}
export interface SalesMeeting { status: string; created_at: string; starts_at: string; confirmed_at?: string | null; owner_name?: string | null; lead_name?: string | null }
export interface SalesInvoice { number?: string | null; client?: string | null; total: number; paid: number; due: string | null; sales?: string | null }

const jday = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10) : '');
const isDay = (iso: string | null | undefined, day: string) => jday(iso) === day;
const addDay = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export interface Movement { newLeads: number; meetingsBooked: number; meetingsHeld: number; noShow: number; proposalsSent: number; invoicesRequested: number; invoicesSent: number; newActive: number }

const emptyMove = (): Movement => ({ newLeads: 0, meetingsBooked: 0, meetingsHeld: 0, noShow: 0, proposalsSent: 0, invoicesRequested: 0, invoicesSent: 0, newActive: 0 });

/** What happened on `day`, in total and per salesperson (the deal's salesperson, the meeting's owner). */
export function movementOf(deals: SalesDeal[], meetings: SalesMeeting[], day: string): { total: Movement; bySales: Array<{ name: string } & Movement> } {
  const total = emptyMove();
  const by = new Map<string, Movement>();
  const of = (name: string | null | undefined) => { const k = String(name || '').trim() || 'Tanpa sales'; if (!by.has(k)) by.set(k, emptyMove()); return by.get(k)!; };
  const bump = (name: string | null | undefined, key: keyof Movement) => { total[key]++; of(name)[key]++; };
  for (const d of deals) {
    if (isDay(d.created_at, day)) bump(d.salesman_name, 'newLeads');
    if (isDay(d.proposal_sent_at, day)) bump(d.salesman_name, 'proposalsSent');
    if (isDay(d.invoice_requested_at, day)) bump(d.salesman_name, 'invoicesRequested');
    if (isDay(d.invoice_generated_at, day)) bump(d.salesman_name, 'invoicesSent');
    if (isDay(d.paid_at || d.acc_approved_at, day)) bump(d.salesman_name, 'newActive');
  }
  for (const m of meetings) {
    if (isDay(m.created_at, day)) bump(m.owner_name, 'meetingsBooked');
    if (isDay(m.starts_at, day) && m.status === 'done') bump(m.owner_name, 'meetingsHeld');
    if (isDay(m.starts_at, day) && m.status === 'no_show') bump(m.owner_name, 'noShow');
  }
  const bySales = [...by.entries()].map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => (b.meetingsHeld + b.meetingsBooked + b.newLeads) - (a.meetingsHeld + a.meetingsBooked + a.newLeads) || a.name.localeCompare(b.name));
  return { total, bySales };
}

export interface Conversion { from: string; to: string; fromCount: number; toCount: number; pct: number | null }
/** How many deals have reached at least this stage (a deal in a later stage counts for every earlier one; Lost deals are left out). */
export function reachedCounts(deals: SalesDeal[]): Map<string, number> {
  const out = new Map<string, number>();
  const live = deals.filter((d) => d.stage !== 'Cold Case' && stageIndex(String(d.stage)) >= 0);
  for (const s of PIPELINE_STAGES) if (s !== 'Cold Case') out.set(s, live.filter((d) => stageIndex(String(d.stage)) >= stageIndex(s)).length);
  return out;
}

const STEPS: Array<[string, string]> = [['Lead', 'Meeting Booked'], ['Meeting Booked', 'Meeting Done'], ['Meeting Done', 'Negotiation'], ['Negotiation', 'Invoice Requested'], ['Invoice', 'Deal']];
/** The conversion between the steps that matter: lead to meeting, meeting held, to negotiation, to invoice, invoice paid. */
export function conversionsOf(deals: SalesDeal[]): Conversion[] {
  const r = reachedCounts(deals);
  return STEPS.map(([from, to]) => {
    const f = r.get(from) ?? 0; const t = r.get(to) ?? 0;
    return { from, to, fromCount: f, toCount: t, pct: f > 0 ? t / f : null };
  });
}

/** After this many days in a stage with no move, a deal is "stuck" (Accounting stages are watched on their own). */
export const STUCK_DAYS: Record<string, number> = { Lead: 5, Contacted: 5, Qualified: 5, Warm: 4, 'Meeting Offered': 3, 'Meeting Done': 3, Negotiation: 7, 'Invoice Requested': 2 };

export interface Stuck { id: string; client: string; sales: string; stage: string; days: number }
export function stuckOf(deals: SalesDeal[], day: string, max = 8): Stuck[] {
  const out: Stuck[] = [];
  for (const d of deals) {
    const lim = STUCK_DAYS[String(d.stage)];
    if (!lim) continue;
    const since = jday(d.stage_changed_at || d.created_at);
    if (!since) continue;
    const days = daysBetween(since, day);
    if (days > lim) out.push({ id: d.id, client: String(d.client || 'Client'), sales: String(d.salesman_name || 'Tanpa sales'), stage: String(d.stage), days });
  }
  return out.sort((a, b) => b.days - a.days).slice(0, max);
}

export interface Unconfirmed { name: string; at: string; owner: string }
/** Meetings tomorrow that the lead has not confirmed yet (the confirmation goes out an hour before, so these are the ones to check). */
export function unconfirmedTomorrow(meetings: SalesMeeting[], day: string): Unconfirmed[] {
  const tomorrow = addDay(day, 1);
  return meetings.filter((m) => m.status === 'booked' && isDay(m.starts_at, tomorrow) && !m.confirmed_at)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((m) => ({ name: String(m.lead_name || 'Lead'), at: m.starts_at, owner: String(m.owner_name || 'Tanpa sales') }));
}

export interface Overdue { number: string; client: string; balance: number; daysLate: number; sales: string }
export function overdueOf(invoices: SalesInvoice[], day: string, max = 8): Overdue[] {
  return invoices
    .map((i) => ({ number: String(i.number || 'Invoice'), client: String(i.client || 'Client'), balance: Math.max(0, i.total - i.paid), daysLate: i.due ? daysBetween(String(i.due).slice(0, 10), day) : 0, sales: String(i.sales || '') }))
    .filter((i) => i.balance > 0.5 && i.daysLate > 0)
    .sort((a, b) => b.balance - a.balance).slice(0, max);
}

export interface SalesBod {
  movement: Movement;
  paymentsToday: { count: number; amount: number };
  bySales: Array<{ name: string } & Movement>;
  funnel: Array<{ stage: string; label: string; count: number; value: number }>;
  conversions: Conversion[];
  stuck: Stuck[];
  unconfirmed: Unconfirmed[];
  overdue: Overdue[];
  showRate30: number | null;      // of the meetings that came due in the last 30 days, the share that happened
}

/** Meetings that came due in the 30 days up to `day`: the share marked Done (the rest did not come). */
export function showRateOf(meetings: SalesMeeting[], day: string): number | null {
  const from = addDay(day, -29);
  const due = meetings.filter((m) => { const d = jday(m.starts_at); return d >= from && d <= day && (m.status === 'done' || m.status === 'no_show'); });
  return due.length ? due.filter((m) => m.status === 'done').length / due.length : null;
}

/** The deals per stage with their value (the funnel now), every stage in order, Lost last. */
export function funnelOf(deals: SalesDeal[]): SalesBod['funnel'] {
  return PIPELINE_STAGES.map((stage) => {
    const list = deals.filter((d) => (stageIndex(String(d.stage)) >= 0 ? d.stage : 'Lead') === stage);
    return { stage, label: stageLabel(stage), count: list.length, value: list.reduce((s, d) => s + Number(d.value || 0), 0) };
  });
}

export function buildSalesBod(input: { deals: SalesDeal[]; meetings: SalesMeeting[]; invoices: SalesInvoice[]; paymentsToday: { count: number; amount: number } }, day: string): SalesBod {
  const m = movementOf(input.deals, input.meetings, day);
  return {
    movement: m.total, paymentsToday: input.paymentsToday, bySales: m.bySales,
    funnel: funnelOf(input.deals), conversions: conversionsOf(input.deals),
    stuck: stuckOf(input.deals, day), unconfirmed: unconfirmedTomorrow(input.meetings, day), overdue: overdueOf(input.invoices, day),
    showRate30: showRateOf(input.meetings, day),
  };
}
