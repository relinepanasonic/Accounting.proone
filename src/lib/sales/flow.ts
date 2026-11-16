// Sales flow rules: pipeline stages and how a project's end date / deliverables follow from the products sold.
// Pure module: safe for server and client.

/**
 * The pipeline, built around the goal of every chat: the free consultation (meeting), then the sale.
 *   New Lead > Contacted > Qualified > Warm > Meeting Offered > Meeting Booked > Meeting Done > Negotiation > Invoice Requested > Invoice Sent > Active Client, and Cold Leads.
 * The STORED names of the stages that existed before are kept, so old deals, invoices and reports keep working; only what people read changed:
 *   'Lead' is shown as "New Lead", 'Invoice' (the invoice exists, not paid yet) as "Invoice Sent", 'Deal' (paid) as "Active Client", 'Cold Case' as "Cold Leads" (no answer after the follow-ups, or not now).
 * This list is the single source: the ERP board, the chat dashboard, the planner, the KPI and the BOD report all read it.
 */
export const PIPELINE_STAGES = ['Lead', 'Contacted', 'Qualified', 'Warm', 'Meeting Offered', 'Meeting Booked', 'Meeting Done', 'Negotiation', 'Invoice Requested', 'Invoice', 'Deal', 'Cold Case'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<string, string> = { Lead: 'New Lead', Invoice: 'Invoice Sent', Deal: 'Active Client', 'Cold Case': 'Cold Leads' };
export const stageLabel = (stage: string) => STAGE_LABEL[stage] || stage;

/** What a lead did to be in the stage (shown under the column title, and in the chat dashboard). */
export const STAGE_HINT: Record<string, string> = {
  Lead: 'First message, nothing known yet',
  Contacted: 'We answered and the lead replied',
  Qualified: 'We know the name, the store and the need',
  Warm: 'Asked about price, packages or the deck',
  'Meeting Offered': 'Free times sent, waiting for a pick',
  'Meeting Booked': 'A consultation is booked',
  'Meeting Done': 'The consultation happened',
  Negotiation: 'Proposal and price, then the ACC',
  'Invoice Requested': 'Waiting for Accounting',
  Invoice: 'Invoice made, waiting for payment',
  Deal: 'Paid: the project starts',
  'Cold Case': 'Quiet after 3 follow-ups, or not now',
};

/** Stages a salesman may drag a card between by hand. The three after Negotiation are reached through the invoice request and the payment only. */
export const MANUAL_STAGES: string[] = ['Lead', 'Contacted', 'Qualified', 'Warm', 'Meeting Offered', 'Meeting Booked', 'Meeting Done', 'Negotiation', 'Cold Case'];
/** Set by the flow only: the invoice request, the invoice, the payment. A card in one of these never moves by hand. */
export const LOCKED_STAGES: string[] = ['Invoice Requested', 'Invoice', 'Deal'];
/** Before the meeting: the stages the bot and the follow-ups work on. */
export const PRE_MEETING_STAGES: string[] = ['Lead', 'Contacted', 'Qualified', 'Warm', 'Meeting Offered'];
/** Still being worked on by sales (not invoiced, not lost). */
export const OPEN_SALES_STAGES: string[] = [...PRE_MEETING_STAGES, 'Meeting Booked', 'Meeting Done', 'Negotiation'];

/** Where a stage sits in the pipeline (Lost is last); -1 for a name that is not a stage. */
export const stageIndex = (stage: string) => (PIPELINE_STAGES as readonly string[]).indexOf(stage);
/** True when `to` is further along than `from`. Used by everything automatic: a bot or a meeting only ever moves a lead forward. */
export const isForward = (from: string, to: string) => stageIndex(to) > stageIndex(from) && stageIndex(from) >= 0;

/** Follow-up task every N days while a card sits in the stage. No entry = no follow-up task. */
export const FOLLOWUP_DAYS: Record<string, number> = { Lead: 2, Contacted: 3, Qualified: 3, Warm: 2, 'Meeting Offered': 2, 'Meeting Done': 2 };

/** Stages where the one-time "send the proposal" task is open until it is done: after the meeting, not before it. */
export const PROPOSAL_STAGES = ['Meeting Done', 'Negotiation'];

const dayOf = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10); // Jakarta calendar day

/**
 * When is the next follow-up due? Counted from the later of: the last follow-up, the day the card entered this stage.
 * Returns the due day (YYYY-MM-DD, Jakarta) or null when the stage has no follow-ups.
 */
export function followUpDueDay(deal: { stage: string; created_at: string; stage_changed_at?: string | null; last_followup_at?: string | null }): string | null {
  const every = FOLLOWUP_DAYS[deal.stage];
  if (!every) return null;
  const marks = [deal.last_followup_at, deal.stage_changed_at || deal.created_at].filter(Boolean) as string[];
  const base = marks.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  return addDays(dayOf(base), every);
}

export interface NegotiationNote {
  at: string;
  by: string;
  text: string;
}

export type DurationType = 'none' | 'day' | 'month' | 'deliverable';

/** One product on an invoice request. The catalog duration is copied in, so later catalog edits do not change old requests. */
export interface RequestItem {
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  scale: string | null;
  duration_type: DurationType;
  duration_value: number;
  deliverable_unit: string | null;
}

export interface Deliverable {
  name: string;
  unit: string;
  total: number;
}

export const requestTotal = (items: Pick<RequestItem, 'quantity' | 'unit_price'>[]) =>
  items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);

// ---- dates (YYYY-MM-DD, UTC so the time zone can never shift a day) ----
const at = (day: string) => new Date(`${day}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  return iso(new Date(at(day).getTime() + n * 86400000));
}

/** Calendar months later; 31 Jan + 1 month = 28/29 Feb (the day is clamped, never spills into March). */
export function addMonths(day: string, n: number): string {
  const d = at(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return iso(target);
}

/**
 * Project terms from the products sold.
 * - Time-based products (days / months): the project ends on the LAST day of the longest one, i.e. start + length - 1 day.
 * - Deliverable products (videos, photos, ...): no end date of their own; listed with their total (value x quantity).
 * - "No project length" products: ignored. If nothing has a time length, end date is empty.
 */
export function computeProjectTerms(items: RequestItem[], startDate: string): { endDate: string | null; deliverables: Deliverable[] } {
  let endDate: string | null = null;
  const deliverables: Deliverable[] = [];
  for (const it of items) {
    const value = Number(it.duration_value || 0);
    if (it.duration_type === 'day' && value > 0) {
      const end = addDays(startDate, value - 1);
      if (!endDate || end > endDate) endDate = end;
    } else if (it.duration_type === 'month' && value > 0) {
      const end = addDays(addMonths(startDate, value), -1);
      if (!endDate || end > endDate) endDate = end;
    } else if (it.duration_type === 'deliverable' && value > 0) {
      deliverables.push({ name: it.name, unit: it.deliverable_unit || 'item', total: value * Math.max(1, Number(it.quantity || 1)) });
    }
  }
  return { endDate, deliverables };
}

export function describeDuration(type: DurationType, value: number, unit?: string | null): string {
  if (type === 'day' && value > 0) return `${value} day${value === 1 ? '' : 's'}`;
  if (type === 'month' && value > 0) return `${value} month${value === 1 ? '' : 's'}`;
  if (type === 'deliverable' && value > 0) return `${value} ${unit || 'item'}${value === 1 ? '' : 's'}`;
  return 'No project length';
}

/**
 * The project length comes from what was SOLD: the quantity and the unit of the invoice line (or of the catalog product).
 * 3 month = 3 months, 10 days = 10 days, 2 weeks = 14 days, 1 year = 12 months. Any other unit (pc, video, photo...) is a number of
 * deliverables: no end date, "30 pc to deliver".
 */
export function lengthFromQuantity(quantity: number, unit?: string | null): { duration_type: DurationType; duration_value: number; deliverable_unit: string | null } {
  const q = Math.max(0, Math.round(Number(quantity) || 0));
  const u = String(unit || '').trim().toLowerCase();
  if (q <= 0) return { duration_type: 'none', duration_value: 0, deliverable_unit: null };
  if (/^(month|months|mo|bulan|bln)$/.test(u)) return { duration_type: 'month', duration_value: q, deliverable_unit: null };
  if (/^(year|years|tahun|thn)$/.test(u)) return { duration_type: 'month', duration_value: q * 12, deliverable_unit: null };
  if (/^(week|weeks|minggu|mgg)$/.test(u)) return { duration_type: 'day', duration_value: q * 7, deliverable_unit: null };
  if (/^(day|days|hari)$/.test(u)) return { duration_type: 'day', duration_value: q, deliverable_unit: null };
  // deliverable: computeProjectTerms multiplies value by the item quantity, so the value is 1 and the quantity is the amount
  return { duration_type: 'deliverable', duration_value: 1, deliverable_unit: u || 'pc' };
}

/** The item with its length taken from its own quantity and unit. */
export function withLengthFromQuantity<T extends { quantity: number; scale: string | null }>(item: T): T & { duration_type: DurationType; duration_value: number; deliverable_unit: string | null } {
  return { ...item, ...lengthFromQuantity(item.quantity, item.scale) };
}
