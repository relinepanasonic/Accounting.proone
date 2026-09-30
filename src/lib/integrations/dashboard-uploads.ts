// Server-side only (uses a secret key): import it from server components / actions, never from client components.
// Upload log of dashboard.profesoronline.id (a separate app). Read through its own API, never its database.
// Env (server only): DASHBOARD_API_URL (default https://dashboard.profesoronline.id) and DASHBOARD_API_KEY.
// Contract: see DASHBOARD_UPLOAD_LOG_API_PROMPT.md.

export const LOG_TIMEZONE = 'Asia/Jakarta';

export interface DashboardUpload {
  id: string;
  uploadedAt: string; // ISO timestamp
  type: string; // "Ads Performance" | "Store Performance"
  admin: string;
  owner?: string;
  store?: string;
  month?: string;
  week?: string;
  files?: string[];
  tags?: string[];
}

export interface DashboardAdmin {
  name: string;
  stores?: string[];
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

export async function getDashboardUploadLog(days = 7): Promise<DashboardUploadLogResult> {
  const apiKey = process.env.DASHBOARD_API_KEY;
  if (!apiKey) return { ok: false, error: 'DASHBOARD_API_KEY is not set.' };

  const base = (process.env.DASHBOARD_API_URL || 'https://dashboard.profesoronline.id').replace(/\/$/, '');
  const dayList = Array.from({ length: days }).map((_, i) => jakartaDay(new Date(Date.now() - i * 86400000)));
  const from = dayList[dayList.length - 1];
  const to = dayList[0];

  try {
    const res = await fetch(`${base}/api/erp/upload-log?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, error: `Dashboard API answered ${res.status}.` };

    const json = await res.json();
    const uploads: DashboardUpload[] = Array.isArray(json?.uploads) ? json.uploads : [];
    const admins: DashboardAdmin[] = Array.isArray(json?.admins) ? json.admins : [];
    return { ok: true, days: dayList, admins, uploads };
  } catch (err: any) {
    return { ok: false, error: err?.name === 'TimeoutError' ? 'Dashboard API timed out.' : 'Could not reach the dashboard API.' };
  }
}
