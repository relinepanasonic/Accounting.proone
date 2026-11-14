// Pure helpers (client-safe): the upload logs of Profesor Dashboard and Reline as one list, and the weekly performance per store.
import { jakartaDay, type DashboardUpload, type DashboardUploadLog, type DashboardUploadLogResult } from './upload-log-shared';

export type ProjectKey = 'profesor' | 'reline' | 'alpha' | 'light';
export const PROJECT_FILTERS: Array<{ key: 'all' | ProjectKey; label: string }> = [
  { key: 'all', label: 'All Project' },
  { key: 'profesor', label: 'Profesor Dashboard' },
  { key: 'reline', label: 'Reline Project' },
  { key: 'alpha', label: 'Alpha Project' },
  { key: 'light', label: 'Light Solution Project' },
];
export const projectLabel = (k: ProjectKey) => PROJECT_FILTERS.find((p) => p.key === k)?.label || k;

/** Reline workspaces: Reline Project 1.0, Alpha Project, Panasonic Light Solution. */
const relineProject = (workspace?: string): ProjectKey => (/alpha/i.test(workspace || '') ? 'alpha' : /light/i.test(workspace || '') ? 'light' : 'reline');

export interface LogRow {
  id: string;
  at: string; // ISO
  day: string; // Jakarta day
  project: ProjectKey;
  admin: string;
  store: string;
  type: string;
  month: string;
  files: string[];
  tags: string[];
  owner: string;
  /** Reline: the workspace the file went to (the report needs it to find the store). */
  workspace?: string;
}

export interface AssignedStore { project: ProjectKey; store: string; pic: string }

export function normalizeLogs(prof: DashboardUploadLogResult, reline: DashboardUploadLogResult): { rows: LogRow[]; assigned: AssignedStore[]; errors: string[] } {
  const rows: LogRow[] = [];
  const assigned: AssignedStore[] = [];
  const errors: string[] = [];
  const add = (u: DashboardUpload, project: ProjectKey) =>
    rows.push({ id: `${project}-${u.id}`, at: u.uploadedAt, day: jakartaDay(new Date(u.uploadedAt)), project, admin: u.admin, store: u.store || '-', type: u.type, month: u.month || '', files: u.files || [], tags: u.tags || [], owner: u.owner || '', workspace: u.workspace || '' });

  if (prof.ok) {
    for (const u of prof.uploads) add(u, 'profesor');
    for (const a of prof.admins) for (const s of a.stores || []) assigned.push({ project: 'profesor', store: s, pic: a.name });
  } else errors.push(`Profesor Dashboard: ${prof.error}`);

  if (reline.ok) {
    for (const u of reline.uploads) add(u, relineProject(u.workspace));
    // The store list of a Reline admin has no workspace: it belongs where that store uploaded, else Reline Project.
    const storeProject = new Map<string, ProjectKey>();
    for (const u of reline.uploads) if (u.store) storeProject.set(u.store, relineProject(u.workspace));
    for (const a of reline.admins) for (const s of a.stores || []) assigned.push({ project: storeProject.get(s) || 'reline', store: s, pic: a.name });
  } else errors.push(`Reline: ${reline.error}`);

  rows.sort((a, b) => b.at.localeCompare(a.at));
  return { rows, assigned, errors };
}

/** Monday of the week (Jakarta) of a YYYY-MM-DD day. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00+07:00`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return jakartaDay(new Date(d.getTime() - dow * 86400000));
}

export interface StorePerformance {
  project: ProjectKey;
  store: string;
  pic: string;
  /** Uploads per week, oldest first, the last one is this week. */
  weeks: Array<{ start: string; count: number }>;
  lastUpload: string | null; // Jakarta day
  daysSince: number | null;
  status: 'on_schedule' | 'late';
}

/**
 * Per store and week: uploaded or not. Note: "On Schedule" when the store has an upload this week or in the last 7 days,
 * otherwise "Late Upload". Stores come from the assignments of both apps plus every store that uploaded.
 */
export function buildPerformance(rows: LogRow[], assigned: AssignedStore[], now = new Date(), weekCount = 4): StorePerformance[] {
  const today = jakartaDay(now);
  const thisWeek = weekStart(today);
  const starts = Array.from({ length: weekCount }, (_, i) => jakartaDay(new Date(new Date(`${thisWeek}T12:00:00+07:00`).getTime() - (weekCount - 1 - i) * 7 * 86400000)));

  const key = (p: ProjectKey, s: string) => `${p}|${s.toLowerCase()}`;
  const stores = new Map<string, { project: ProjectKey; store: string; pic: string }>();
  for (const a of assigned) stores.set(key(a.project, a.store), { project: a.project, store: a.store, pic: a.pic });
  for (const r of rows) if (r.store && r.store !== '-' && !stores.has(key(r.project, r.store))) stores.set(key(r.project, r.store), { project: r.project, store: r.store, pic: '' });

  const byStore = new Map<string, LogRow[]>();
  for (const r of rows) (byStore.get(key(r.project, r.store)) || byStore.set(key(r.project, r.store), []).get(key(r.project, r.store))!).push(r);

  const out: StorePerformance[] = [];
  for (const [k, s] of stores) {
    const list = byStore.get(k) || [];
    const weeks = starts.map((start) => ({ start, count: list.filter((r) => weekStart(r.day) === start).length }));
    const last = list.map((r) => r.day).sort().pop() || null;
    const daysSince = last ? Math.round((new Date(`${today}T12:00:00+07:00`).getTime() - new Date(`${last}T12:00:00+07:00`).getTime()) / 86400000) : null;
    const onSchedule = weeks[weeks.length - 1].count > 0 || (daysSince !== null && daysSince <= 7);
    out.push({ ...s, weeks, lastUpload: last, daysSince, status: onSchedule ? 'on_schedule' : 'late' });
  }
  return out.sort((a, b) => (a.status === b.status ? a.store.localeCompare(b.store) : a.status === 'late' ? -1 : 1));
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export interface FileEntry { type: string; name: string; admin: string; at: string }

export interface MonthStoreRow {
  project: ProjectKey;
  store: string;
  /** Reline workspace of the store (empty for Profesor Dashboard). */
  workspace: string;
  client: string;
  /** The files of each week (Monday to Sunday) of the month, up to 5. null = the month has no such week, or it has not ended and nothing was uploaded. */
  weekFiles: Array<FileEntry[] | null>;
  /** On Schedule / Late Upload. null for a month that has not started. */
  status: 'on_schedule' | 'late' | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const addDaysIso = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/** The Mondays of a month: its weeks (Monday to Sunday). A week belongs to the month of its Monday, so a month has 4 or 5 weeks. */
export function mondaysOf(year: number, month: number): string[] {
  const out: string[] = [];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= days; d++) if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 1) out.push(`${year}-${pad2(month)}-${pad2(d)}`);
  return out;
}

/** The weeks of a month for the table header: Monday and Sunday of each. */
export const monthWeeks = (year: number, month: number) => mondaysOf(year, month).map((monday) => ({ monday, sunday: addDaysIso(monday, 6) }));

/** The days to read from the upload log for a month: the week files of a month are uploaded up to about 10 days after its last Sunday. */
export function monthFetchRange(year: number, month: number, today: string): { from: string; to: string } {
  const weeks = monthWeeks(year, month);
  const from = `${year}-${pad2(month)}-01`;
  const end = addDaysIso(weeks[weeks.length - 1].sunday, 10);
  return { from, to: end < today ? end : today < from ? from : today };
}

const MONTH_WORDS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5,
  jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, ags: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, des: 12, dec: 12, desember: 12, december: 12,
};
const MONTH_RE = new RegExp(`(?:^|[^a-z])(${Object.keys(MONTH_WORDS).sort((x, y) => y.length - x.length).join('|')})(?![a-z])(?:[\\s_-]*'?(\\d{4}|\\d{2})(?!\\d))?`, 'i');

/** "essen ads nov week 1.csv" -> November; "essen ps sep 26.xlsx" -> September 2026; "2026-10" -> October 2026. */
export function monthFromText(text: string): { month: number; year: number | null } | null {
  const t = String(text || '');
  const iso = /(20\d{2})-(0[1-9]|1[0-2])/.exec(t);
  if (iso) return { month: Number(iso[2]), year: Number(iso[1]) };
  const m = MONTH_RE.exec(t.toLowerCase());
  if (!m) return null;
  const y = m[2] ? Number(m[2]) : null;
  return { month: MONTH_WORDS[m[1].toLowerCase()], year: y === null ? null : y < 100 ? (y >= 24 && y <= 35 ? 2000 + y : null) : y };
}

/**
 * The week a file is about (its Monday), or null for a file of a whole month ("essen ps sep 26.xlsx").
 * The month comes from the file name, else from the month the app logged; the week from "week N" (the N-th Monday of that month).
 * A file without a week is the week before the upload day (the team uploads a week after it ends).
 */
export function dataWeekOf(name: string, loggedMonth: string, uploadDay: string): string | null {
  const wk = /week\s*0?([1-5])(?!\d)/i.exec(name);
  const fromName = monthFromText(name.replace(/week\s*0?[1-5]/ig, ' '));
  const mon = fromName || monthFromText(loggedMonth);
  const lastWeek = addDaysIso(weekStart(uploadDay), -7);
  if (!mon) {
    if (!wk) return lastWeek;
    // "ads week 4.csv": week 4 of the month of the week before the upload
    const y = Number(lastWeek.slice(0, 4)); const m = Number(lastWeek.slice(5, 7));
    const ms = mondaysOf(y, m);
    return ms[Math.min(Number(wk[1]), ms.length) - 1];
  }
  const upY = Number(uploadDay.slice(0, 4)); const upM = Number(uploadDay.slice(5, 7));
  const year = mon.year ?? (mon.month > upM ? upY - 1 : upY);
  if (!wk) {
    // a month file: only a week of the same month when that month is the one of the upload
    return lastWeek.slice(0, 7) === `${year}-${pad2(mon.month)}` ? lastWeek : null;
  }
  const ms = mondaysOf(year, mon.month);
  return ms[Math.min(Number(wk[1]), ms.length) - 1];
}

/** @deprecated kept for older callers: the week number (1-5) of a file inside its own month. */
export function weekOfFile(name: string, day: string): number {
  const monday = dataWeekOf(name, '', day);
  if (!monday) return 1;
  return mondaysOf(Number(monday.slice(0, 4)), Number(monday.slice(5, 7))).indexOf(monday) + 1;
}

const GRACE_DAYS = 3; // a week's files are expected within 3 days after its Sunday

/**
 * The Performance table of one month: per store the files of each week (Monday to Sunday, the week belongs to the month of its Monday), and a status.
 * A file is put in the week it is ABOUT (month and "week N" from its name), not the day it was uploaded: October files uploaded in November stay in October.
 * A week that has not ended yet is "-" (nothing is due). Status: every ended week has files; the last one may still be within 3 days.
 * clientOf: the ERP client of a store (by its store or brand name); the owner named in the feed is the fallback.
 */
export function buildMonthTable(rows: LogRow[], assigned: AssignedStore[], year: number, month: number, clientOf: (store: string) => string, now = new Date()): MonthStoreRow[] {
  const today = jakartaDay(now);
  const weeks = monthWeeks(year, month);
  const index = new Map(weeks.map((w, i) => [w.monday, i] as [string, number]));
  const key = (p: ProjectKey, s: string) => `${p}|${normName(s)}`;

  // every file of the log, placed in the week it is about; only the ones of this month are kept
  const placed: Array<{ r: LogRow; name: string; week: number }> = [];
  for (const r of rows) {
    const names = r.files.length ? r.files : ['(no file name)'];
    for (const name of names) {
      const monday = dataWeekOf(name === '(no file name)' ? '' : name, r.month, r.day);
      const w = monday ? index.get(monday) : undefined;
      if (w !== undefined) placed.push({ r, name, week: w });
    }
  }

  const stores = new Map<string, { project: ProjectKey; store: string; owner: string; workspace: string }>();
  for (const a of assigned) stores.set(key(a.project, a.store), { project: a.project, store: a.store, owner: '', workspace: '' });
  for (const { r } of placed) if (r.store && r.store !== '-') {
    const k = key(r.project, r.store);
    const cur = stores.get(k);
    if (!cur) stores.set(k, { project: r.project, store: r.store, owner: r.owner, workspace: r.workspace || '' });
    else { if (!cur.owner && r.owner) cur.owner = r.owner; if (!cur.workspace && r.workspace) cur.workspace = r.workspace; }
  }
  // stores of a Reline workspace that only uploaded files of other months still need their workspace
  for (const r of rows) { const cur = stores.get(key(r.project, r.store)); if (cur && !cur.workspace && r.workspace) cur.workspace = r.workspace; }

  const due = weeks.map((w) => w.sunday < today);
  const lastDue = due.lastIndexOf(true);
  const inGrace = lastDue >= 0 && (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weeks[lastDue].sunday}T00:00:00Z`)) / 86400000 <= GRACE_DAYS;

  const out: MonthStoreRow[] = [];
  for (const [k, st] of stores) {
    const mine = placed.filter((p) => key(p.r.project, p.r.store) === k);
    const weekFiles: Array<FileEntry[] | null> = [0, 1, 2, 3, 4].map((i) => (i < weeks.length && due[i] ? [] : null));
    for (const p of mine) {
      if (weekFiles[p.week] === null) weekFiles[p.week] = []; // files of a week that has not ended yet still show
      weekFiles[p.week]!.push({ type: p.r.type, name: p.name, admin: p.r.admin, at: p.r.at });
    }
    let status: MonthStoreRow['status'] = null;
    if (lastDue >= 0) {
      const missing = weeks.map((_, i) => i).filter((i) => due[i] && !(weekFiles[i]?.length));
      const late = missing.some((i) => i !== lastDue || !inGrace);
      status = late ? 'late' : 'on_schedule';
    }
    out.push({ project: st.project, store: st.store, workspace: st.workspace, client: clientOf(st.store) || st.owner || '-', weekFiles, status });
  }
  return out.sort((x, y) => x.project.localeCompare(y.project) || x.store.localeCompare(y.store));
}

/** Normalized key for matching a feed store to an ERP client by store or brand name. */
export const storeKey = normName;
