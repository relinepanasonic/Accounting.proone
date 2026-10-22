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
}

export interface AssignedStore { project: ProjectKey; store: string; pic: string }

export function normalizeLogs(prof: DashboardUploadLogResult, reline: DashboardUploadLogResult): { rows: LogRow[]; assigned: AssignedStore[]; errors: string[] } {
  const rows: LogRow[] = [];
  const assigned: AssignedStore[] = [];
  const errors: string[] = [];
  const add = (u: DashboardUpload, project: ProjectKey) =>
    rows.push({ id: `${project}-${u.id}`, at: u.uploadedAt, day: jakartaDay(new Date(u.uploadedAt)), project, admin: u.admin, store: u.store || '-', type: u.type, month: u.month || '', files: u.files || [], tags: u.tags || [], owner: u.owner || '' });

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

/** The kinds of upload a store has to deliver. Profesor Dashboard only carries the first five; the rest are Reline's. */
export const UPLOAD_KINDS = [
  { key: 'store', label: 'Store' },
  { key: 'product', label: 'Product' },
  { key: 'adsTotal', label: 'Ads Total' },
  { key: 'adsGroup', label: 'Ads Group' },
  { key: 'adsInkubasi', label: 'Ads Inkubasi' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'orderCompleted', label: 'Order Completed' },
  { key: 'earning', label: 'Earning' },
] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number]['key'];
const PROFESOR_KINDS: UploadKind[] = ['store', 'product', 'adsTotal', 'adsGroup', 'adsInkubasi'];

/** Which kinds one logged upload covers (Profesor by its tags, Reline by its type). */
export function kindsOf(row: Pick<LogRow, 'project' | 'type' | 'tags'>): UploadKind[] {
  if (row.project === 'profesor') {
    const out: UploadKind[] = [];
    for (const t of row.tags) {
      if (/^store performance$/i.test(t)) out.push('store');
      else if (/^product performance$/i.test(t)) out.push('product');
      else if (/^ads performance$/i.test(t)) out.push('adsTotal');
      else if (/^(group|hero|low conv\.?)$/i.test(t)) out.push('adsGroup');
      else if (/^inkubasi$/i.test(t)) out.push('adsInkubasi');
    }
    return out;
  }
  const t = row.type.toLowerCase();
  if (t.includes('shipping')) return ['shipping'];
  if (t === 'performa') return ['store'];
  if (t === 'spos') return ['product'];
  if (t === 'ads') return ['adsTotal'];
  if (t === 'group ads') return ['adsGroup'];
  if (t === 'gmv auto') return ['adsInkubasi'];
  if (t === 'demographic') return ['orderCompleted'];
  if (t === 'earning') return ['earning'];
  return [];
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export interface MonthStoreRow {
  project: ProjectKey;
  store: string;
  client: string;
  /** Uploads per block of the month: days 1-7, 8-14, 15-21, 22-28, 29-end. null = that block has not started yet. */
  weeks: Array<number | null>;
  /** Per kind: uploaded this month (true / false), or null when that project does not carry the kind. */
  kinds: Record<UploadKind, boolean | null>;
}

/**
 * The Performance table of one month: per store the uploads of each of the 5 blocks of the month, and which kinds were uploaded.
 * clientOf: the ERP client of a store (by its store or brand name); the owner named in the feed is the fallback.
 */
export function buildMonthTable(rows: LogRow[], assigned: AssignedStore[], year: number, month: number, clientOf: (store: string) => string, now = new Date()): MonthStoreRow[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const today = jakartaDay(now);
  const key = (p: ProjectKey, s: string) => `${p}|${normName(s)}`;
  const stores = new Map<string, { project: ProjectKey; store: string; owner: string }>();
  for (const a of assigned) stores.set(key(a.project, a.store), { project: a.project, store: a.store, owner: '' });
  const inMonth = rows.filter((r) => r.day.startsWith(prefix));
  for (const r of inMonth) if (r.store && r.store !== '-') {
    const k = key(r.project, r.store);
    const cur = stores.get(k);
    if (!cur) stores.set(k, { project: r.project, store: r.store, owner: r.owner });
    else if (!cur.owner && r.owner) cur.owner = r.owner;
  }

  const out: MonthStoreRow[] = [];
  for (const [k, s] of stores) {
    const list = inMonth.filter((r) => key(r.project, r.store) === k);
    const weeks: Array<number | null> = [0, 1, 2, 3, 4].map((b) => {
      const first = `${prefix}${String(b * 7 + 1).padStart(2, '0')}`;
      if (first > today) return null;
      return list.filter((r) => Math.min(4, Math.floor((Number(r.day.slice(8, 10)) - 1) / 7)) === b).length;
    });
    const done = new Set<UploadKind>();
    for (const r of list) for (const kd of kindsOf(r)) done.add(kd);
    const kinds = Object.fromEntries(UPLOAD_KINDS.map((u) => [u.key, s.project === 'profesor' && !PROFESOR_KINDS.includes(u.key) ? null : done.has(u.key)])) as Record<UploadKind, boolean | null>;
    out.push({ project: s.project, store: s.store, client: clientOf(s.store) || s.owner || '-', weeks, kinds });
  }
  return out.sort((a, b) => a.project.localeCompare(b.project) || a.store.localeCompare(b.store));
}

/** Normalized key for matching a feed store to an ERP client by store or brand name. */
export const storeKey = normName;
