// When a recurring brief runs. Pure functions (dates are "YYYY-MM-DD" in Jakarta time): safe for server and client.

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'once';

export interface ScheduleRule {
  cadence: Cadence;
  weekday: number | null; // 0 = Sunday
  monthday: number | null;
  run_date: string | null;
  run_time: string; // "HH:MM"
  enabled: boolean;
}

export const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const at = (day: string) => new Date(`${day}T12:00:00Z`);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

/** Does this schedule run on that day? */
export function runsOn(rule: ScheduleRule, day: string): boolean {
  if (!rule.enabled) return false;
  const d = at(day);
  switch (rule.cadence) {
    case 'daily':
      return true;
    case 'weekly':
      return rule.weekday !== null && d.getUTCDay() === rule.weekday;
    case 'monthly': {
      if (!rule.monthday) return false;
      const last = daysInMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
      return d.getUTCDate() === Math.min(rule.monthday, last); // the 31st runs on the 30th in a 30-day month
    }
    case 'once':
      return rule.run_date === day;
  }
}

/** Plain-language description, e.g. "Setiap Senin 07:00". */
export function describeRule(rule: ScheduleRule): string {
  switch (rule.cadence) {
    case 'daily':
      return `Setiap hari ${rule.run_time}`;
    case 'weekly':
      return `Setiap ${WEEKDAYS[rule.weekday ?? 1]} ${rule.run_time}`;
    case 'monthly':
      return `Setiap tanggal ${rule.monthday} ${rule.run_time}`;
    case 'once':
      return `Sekali, ${rule.run_date || '?'} ${rule.run_time}`;
  }
}

export function jakartaNow(now = new Date()): { day: string; time: string } {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  return { day, time };
}

/** Due now = runs today, its time has come, and it has not run today yet. */
export function isDue(rule: ScheduleRule & { last_run_at: string | null }, now = new Date()): boolean {
  const { day, time } = jakartaNow(now);
  if (!runsOn(rule, day) || time < rule.run_time) return false;
  if (!rule.last_run_at) return true;
  return jakartaNow(new Date(rule.last_run_at)).day !== day;
}
