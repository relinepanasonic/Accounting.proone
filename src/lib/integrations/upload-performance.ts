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
}

export interface AssignedStore { project: ProjectKey; store: string; pic: string }

export function normalizeLogs(prof: DashboardUploadLogResult, reline: DashboardUploadLogResult): { rows: LogRow[]; assigned: AssignedStore[]; errors: string[] } {
  const rows: LogRow[] = [];
  const assigned: AssignedStore[] = [];
  const errors: string[] = [];
  const add = (u: DashboardUpload, project: ProjectKey) =>
    rows.push({ id: `${project}-${u.id}`, at: u.uploadedAt, day: jakartaDay(new Date(u.uploadedAt)), project, admin: u.admin, store: u.store || '-', type: u.type, month: u.month || '', files: u.files || [] });

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
