// Calendar rules for the KPI dashboards. Everything is a "YYYY-MM-DD" string in Jakarta time.
import { jakartaDay } from '@/lib/integrations/dashboard-uploads';

export const todayJakarta = () => jakartaDay(new Date());

const at = (day: string) => new Date(`${day}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => iso(new Date(at(day).getTime() + n * 86400000));
const dow = (day: string) => at(day).getUTCDay(); // 0 = Sunday

/** Ad sessions due per client on a day: 3 on twin dates (1.1, 2.2 ... 12.12) and payday (the 25th), otherwise 2. */
export function adSessionTarget(day: string): number {
  const [, m, d] = day.split('-').map(Number);
  return d === m || d === 25 ? 3 : 2;
}
export const isSpecialAdDay = (day: string) => adSessionTarget(day) === 3;

/** Admin works Monday to Saturday; Sunday is free. */
export const isAdminWorkday = (day: string) => dow(day) !== 0;

/** Monday .. Saturday of the week that contains `day`. */
export function workWeek(day: string): string[] {
  const back = (dow(day) + 6) % 7; // days since Monday
  const monday = addDays(day, -back);
  return Array.from({ length: 6 }).map((_, i) => addDays(monday, i));
}

export const monthKey = (day: string) => day.slice(0, 7);
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

/** Every day from the 1st of the month up to `day`. */
export function monthDaysSoFar(day: string): string[] {
  const out: string[] = [];
  for (let d = monthStart(day); d <= day; d = addDays(d, 1)) out.push(d);
  return out;
}

export const daysBetween = (from: string, to: string) => Math.round((at(to).getTime() - at(from).getTime()) / 86400000);

export const fmtShort = (day: string) =>
  at(day).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short' });
export const fmtMonthLabel = (day: string) =>
  at(day).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });

/** Lower-case, letters and digits only, so "Emkey.Clothing" and "emkey clothing" match. */
export const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
