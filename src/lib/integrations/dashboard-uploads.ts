// Server-side only (uses a secret key): import it from server components / actions, never from client components.
// Upload logs of dashboard.profesoronline.id and reline.profesoronline.id (separate apps). Read through their own API, never their database.
// Env (server only): DASHBOARD_API_URL / DASHBOARD_API_KEY and RELINE_API_URL / RELINE_API_KEY.
// Contracts: DASHBOARD_UPLOAD_LOG_API_PROMPT.md and RELINE_UPLOAD_LOG_API_PROMPT.md.

import { jakartaDay, type DashboardAdmin, type DashboardUpload, type DashboardUploadLogResult } from './upload-log-shared';

export * from './upload-log-shared';

/** The feed answers at most 60 days per call. */
const MAX_RANGE_DAYS = 60;
/** The log is not real time; a short cache keeps the Admin page fast. */
const CACHE_SECONDS = 120;

export const getDashboardUploadLog = (days = 7) =>
  fetchUploadLog(days, 'DASHBOARD_API_KEY', process.env.DASHBOARD_API_KEY, process.env.DASHBOARD_API_URL || 'https://dashboard.profesoronline.id');

export const getRelineUploadLog = (days = 7) =>
  fetchUploadLog(days, 'RELINE_API_KEY', process.env.RELINE_API_KEY, process.env.RELINE_API_URL || 'https://reline.profesoronline.id');

const addDays = (day: string, n: number) => jakartaDay(new Date(new Date(`${day}T12:00:00+07:00`).getTime() + n * 86400000));

export async function fetchUploadLog(days: number, keyName: string, apiKey: string | undefined, baseUrl: string): Promise<DashboardUploadLogResult> {
  if (!apiKey) return { ok: false, error: `${keyName} is not set.` };

  const base = baseUrl.replace(/\/$/, '');
  const dayList = Array.from({ length: days }).map((_, i) => jakartaDay(new Date(Date.now() - i * 86400000)));

  // Ranges longer than 60 days are asked for in several calls, oldest chunk first.
  const chunks: Array<{ from: string; to: string }> = [];
  const oldest = dayList[dayList.length - 1];
  for (let from = oldest; from <= dayList[0]; ) {
    const to = addDays(from, MAX_RANGE_DAYS - 1);
    chunks.push({ from, to: to > dayList[0] ? dayList[0] : to });
    from = addDays(from, MAX_RANGE_DAYS);
  }

  try {
    const uploads: DashboardUpload[] = [];
    const admins = new Map<string, DashboardAdmin>();
    for (const c of chunks) {
      const res = await fetch(`${base}/api/erp/upload-log?from=${c.from}&to=${c.to}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        next: { revalidate: CACHE_SECONDS },
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      // A redirect means the app's login middleware caught the request (endpoint missing or not exempted).
      if (res.status >= 300 && res.status < 400) {
        return { ok: false, error: 'The API redirected to its login page: /api/erp/* must skip the login middleware (or the endpoint does not exist yet).' };
      }
      if (res.status === 401) return { ok: false, error: `The API refused the key (401): ${keyName} here must equal ERP_API_KEY there.` };
      if (res.status === 400) return { ok: false, error: 'The API rejected the dates (400).' };
      if (!res.ok) return { ok: false, error: `The API answered ${res.status}.` };

      const json = await res.json();
      if (Array.isArray(json?.uploads)) uploads.push(...json.uploads);
      if (Array.isArray(json?.admins)) for (const a of json.admins as DashboardAdmin[]) if (!admins.has(a.name)) admins.set(a.name, a);
    }
    return { ok: true, days: dayList, admins: Array.from(admins.values()), uploads };
  } catch (err: any) {
    return { ok: false, error: err?.name === 'TimeoutError' ? 'The API timed out.' : 'Could not reach the API.' };
  }
}
