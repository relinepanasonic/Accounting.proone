// Sales flow rules: pipeline stages and how a project's end date / deliverables follow from the products sold.
// Pure module: safe for server and client.

// 'Invoice' is the stored name of the "Waiting Payment" column: the invoice exists and the client has not paid yet.
// 'Cold Case' comes after Deal: a lead the salesman gave up chasing. Follow-up tasks stop there.
export const PIPELINE_STAGES = ['Lead', 'Contacted', 'Negotiation', 'Invoice', 'Deal', 'Cold Case'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<string, string> = { Invoice: 'Waiting Payment' };
export const stageLabel = (stage: string) => STAGE_LABEL[stage] || stage;

/** Stages a salesman may drag a card between by hand. Invoice and Deal are reached through the flow. */
export const MANUAL_STAGES: string[] = ['Lead', 'Contacted', 'Negotiation', 'Cold Case'];

/** Follow-up task every N days while a card sits in the stage. No entry = no follow-up task. */
export const FOLLOWUP_DAYS: Record<string, number> = { Lead: 2, Contacted: 7 };

/** Stages where the one-time "send the proposal" task is open until it is done. */
export const PROPOSAL_STAGES = ['Lead', 'Contacted'];

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
