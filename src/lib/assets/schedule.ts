/**
 * Schedule Expense of a fixed asset: the cost (minus the salvage value) is spread over the months the asset takes to reach 0.
 * Bought 24 Oct 2026 for 12 mio over 12 months = 12 payments of 1 mio, on 24 Oct, 24 Nov, 24 Dec... (a 31st becomes the last day of a short month).
 * The first payment is due on the purchase day, so it is posted at once; the others are posted on their day.
 */

export interface ScheduleLine { seq: number; due_date: string; amount: number }

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate();

/** The purchase date plus k months, keeping the day (clamped to the end of a shorter month). */
export function addMonths(date: string, k: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const t = (m - 1) + k;
  const year = y + Math.floor(t / 12);
  const month = ((t % 12) + 12) % 12 + 1;
  return `${year}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Spread `base` over `count` payments starting at `firstSeq`; the last one takes the rounding. */
export function spread(purchaseDate: string, base: number, count: number, firstSeq = 1): ScheduleLine[] {
  if (count <= 0 || base <= 0) return [];
  const per = round2(base / count);
  const out: ScheduleLine[] = [];
  let used = 0;
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? round2(base - used) : per;
    used = round2(used + amount);
    out.push({ seq: firstSeq + i, due_date: addMonths(purchaseDate, firstSeq - 1 + i), amount });
  }
  return out;
}

/** The whole schedule of a new asset. */
export const buildSchedule = (purchaseDate: string, months: number, cost: number, salvage: number): ScheduleLine[] =>
  spread(purchaseDate, Math.max(0, cost - salvage), Math.max(1, Math.round(months)));

/** The months an asset takes to reach 0 (stored as years, can be fractional). */
export const monthsOf = (usefulLifeYears: number | null | undefined) => Math.max(1, Math.round(Number(usefulLifeYears || 1) * 12));
