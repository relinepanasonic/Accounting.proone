// Pure helpers shared by the server fetcher and the Admin page (safe in client components: no env, no fetch).

export const LOG_TIMEZONE = 'Asia/Jakarta';

export interface DashboardUpload {
  id: string;
  uploadedAt: string; // ISO timestamp
  type: string; // "Ads Performance" | "Store Performance" | "Performa" | "SPOS" | "Ads" | ...
  admin: string;
  owner?: string;
  store?: string;
  month?: string;
  week?: string;
  workspace?: string; // Reline: which workspace the upload went to
  files?: string[];
  tags?: string[];
}

export interface DashboardAdmin {
  name: string;
  stores?: string[];
  workspaces?: string[];
}

export interface DashboardUploadLog {
  ok: true;
  days: string[]; // YYYY-MM-DD in Asia/Jakarta, newest first
  admins: DashboardAdmin[];
  uploads: DashboardUpload[];
}

export type DashboardUploadLogResult = DashboardUploadLog | { ok: false; error: string };

/** YYYY-MM-DD for a date in Jakarta time. */
export function jakartaDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LOG_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export interface AdminRow {
  name: string;
  /** Uploads of this admin per Jakarta day, newest first. */
  perDay: Record<string, DashboardUpload[]>;
  daysActive: number;
  total: number;
}

export interface UploadLogSummary {
  /** Only people the feed lists as admins: they are the ones who can be "missing". Matched by exact name. */
  admins: AdminRow[];
  /** Uploads by people who are not in the admins list (an owner, "Bulk import"...): information only, never "missing". */
  others: Array<{ name: string; total: number }>;
}

export function summarizeUploadLog(log: DashboardUploadLog): UploadLogSummary {
  const adminNames = new Set(log.admins.map((a) => a.name));
  const rows = new Map<string, AdminRow>();
  for (const name of adminNames) rows.set(name, { name, perDay: {}, daysActive: 0, total: 0 });
  const others = new Map<string, number>();

  const sorted = [...log.uploads].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  for (const u of sorted) {
    const row = rows.get(u.admin);
    if (!row) { others.set(u.admin || '-', (others.get(u.admin || '-') || 0) + 1); continue; }
    const day = jakartaDay(new Date(u.uploadedAt));
    (row.perDay[day] ||= []).push(u);
    row.total++;
  }
  for (const r of rows.values()) r.daysActive = Object.keys(r.perDay).length;

  return {
    admins: Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name)),
    others: Array.from(others.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
  };
}
