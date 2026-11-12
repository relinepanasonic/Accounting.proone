/**
 * The status table of WA Control > Admin: which reports went to which client. Pure helpers (the data loading is in board-data.ts).
 * Monthly table: one row per store, a column for each week of the month (a check when the weekly report was sent) and a Monthly Report column.
 * Click a row for the days: Mon..Sun (the advertiser session reports sent that day) and the Week.
 */

const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** "2026-11" when it is valid, else the fallback (a bad value in the URL must never break the page). */
export function validMonth(v: string | undefined | null, fallback: string): string {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : fallback;
}

export const shiftMonth = (month: string, by: number): string => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1, 12));
  return d.toISOString().slice(0, 7);
};

export interface MonthWeek { from: string; to: string; label: string; n: number }

/** The weeks of a month: every Monday inside the month starts "Week 1", "Week 2"... (up to 5), each running Monday to Sunday. */
export function monthWeeks(month: string): MonthWeek[] {
  const first = `${month}-01`;
  const dow = new Date(`${first}T12:00:00Z`).getUTCDay();            // 0 = Sunday
  let monday = addDays(first, (8 - dow) % 7 || (dow === 1 ? 0 : 7));  // the first Monday on or after the 1st
  if (dow === 1) monday = first;
  const out: MonthWeek[] = [];
  for (let n = 1; monday.slice(0, 7) === month && n <= 5; n++, monday = addDays(monday, 7)) {
    out.push({ from: monday, to: addDays(monday, 6), n, label: `Week ${n}` });
  }
  return out;
}

/** The 7 dates of a week, Monday first. */
export const weekDates = (weekFrom: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));

export type CellState = 'sent' | 'draft' | 'failed' | 'skipped' | 'none';
export interface BoardCell { state: CellState; id?: string }

/** A weekly report row's status as a table cell. */
export function cellOf(row?: { id: string; status: string } | null): BoardCell {
  if (!row) return { state: 'none' };
  if (row.status === 'sent') return { state: 'sent', id: row.id };
  if (row.status === 'failed') return { state: 'failed', id: row.id };
  if (row.status === 'skipped') return { state: 'skipped', id: row.id };
  return { state: 'draft', id: row.id };       // draft or sending
}

/** One session box of a day: sent to the client group (green), logged by the advertiser but not sent (amber), or nothing. */
export interface SessionCell { session: number; state: 'sent' | 'logged' | 'none'; sendId: string | null; hasCopy: boolean }
export interface DayCell { date: string; sessions: SessionCell[] }

/** Sessions that are always shown for a day (the advertisers report 2-3 times a day). A higher session shows when it was logged or sent. */
export const MIN_SESSIONS = 3;

export function sessionCells(logged: Set<number>, sent: Map<number, { id: string; hasCopy: boolean }>): SessionCell[] {
  const max = Math.max(MIN_SESSIONS, ...logged, ...sent.keys());
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const s = sent.get(n);
    return { session: n, state: s ? 'sent' : logged.has(n) ? 'logged' : 'none', sendId: s?.id ?? null, hasCopy: !!s?.hasCopy } as SessionCell;
  });
}

/** The key of a session send (what wa_sends.ref holds): client | store | date | session. */
export const sessionRef = (clientId: string, store: string, date: string, session: number) => [clientId, store, date, session].join('|');
export function parseSessionRef(ref: string | null | undefined): { clientId: string; store: string; date: string; session: number } | null {
  const p = String(ref || '').split('|');
  if (p.length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(p[p.length - 2])) return null;
  return { clientId: p[0], store: p.slice(1, p.length - 2).join('|'), date: p[p.length - 2], session: Number(p[p.length - 1]) };
}
