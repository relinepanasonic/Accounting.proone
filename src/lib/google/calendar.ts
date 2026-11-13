import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Google Calendar for the free consultations: one Gmail account (the team's shared calendar), connected once with Google's sign-in.
 * We keep only the refresh token (server side), and use it to read busy times and to create events with a Google Meet link.
 * Settings on the server: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (from a Google Cloud "OAuth client", type Web application).
 */
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const CAL = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'];

export const googleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
export const redirectUri = () => process.env.GOOGLE_REDIRECT_URI || 'https://erp.profesoronline.id/api/google/callback';

// ---------------------------------------------------------------- the sign-in link, bound to the workspace and good for 15 minutes
const sign = (payload: string) => createHmac('sha256', String(process.env.GOOGLE_CLIENT_SECRET || '')).update(payload).digest('base64url');

export function makeState(ws: string, by: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ws, by: by.slice(0, 60), exp: now + 15 * 60000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function readState(state: string | null, now = Date.now()): { ws: string; by: string } | null {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) return null;
  const want = sign(payload);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const j = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof j?.ws === 'string' && Number(j?.exp) > now ? { ws: j.ws, by: String(j.by || '') } : null;
  } catch { return null; }
}

export function authUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: String(process.env.GOOGLE_CLIENT_ID), redirect_uri: redirectUri(), response_type: 'code', scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  return `${AUTH}?${q}`;
}

/** The code from Google's sign-in becomes a refresh token (kept) and the account's email (shown). */
export async function exchangeCode(code: string): Promise<{ ok: true; refreshToken: string; email: string | null } | { ok: false; error: string }> {
  const res = await fetch(TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: String(process.env.GOOGLE_CLIENT_ID), client_secret: String(process.env.GOOGLE_CLIENT_SECRET), redirect_uri: redirectUri(), grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(15000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.refresh_token) return { ok: false, error: String(j?.error_description || j?.error || 'Google did not give a lasting access. Try Connect again.') };
  let email: string | null = null;
  try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString('utf8'))?.email ?? null; } catch { /* no email: fine */ }
  return { ok: true, refreshToken: String(j.refresh_token), email };
}

export async function accessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: String(process.env.GOOGLE_CLIENT_ID), client_secret: String(process.env.GOOGLE_CLIENT_SECRET), grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new Error(j?.error === 'invalid_grant' ? 'The Google connection expired or was removed. Connect Google Calendar again.' : `Google refused: ${j?.error || res.status}`);
  return String(j.access_token);
}

/** Busy times on the calendar between two moments. */
export async function busyTimes(token: string, calendarId: string, from: Date, to: Date): Promise<Array<{ start: Date; end: Date }>> {
  const res = await fetch(`${CAL}/freeBusy`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: 'Asia/Jakarta', items: [{ id: calendarId }] }),
    signal: AbortSignal.timeout(10000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Google Calendar: ${j?.error?.message || res.status}`);
  const busy = j?.calendars?.[calendarId]?.busy;
  return (Array.isArray(busy) ? busy : []).map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

/** A calendar event with a Google Meet link. Returns the event id and the link (null if Google gave none). */
export async function createMeetEvent(token: string, calendarId: string, e: { title: string; description: string; start: Date; end: Date; requestId: string }): Promise<{ id: string; meetUrl: string | null }> {
  const res = await fetch(`${CAL}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      summary: e.title, description: e.description,
      start: { dateTime: e.start.toISOString(), timeZone: 'Asia/Jakarta' }, end: { dateTime: e.end.toISOString(), timeZone: 'Asia/Jakarta' },
      conferenceData: { createRequest: { requestId: e.requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.id) throw new Error(`Google Calendar: ${j?.error?.message || res.status}`);
  const meet = j.hangoutLink || (Array.isArray(j?.conferenceData?.entryPoints) ? j.conferenceData.entryPoints.find((p: any) => p.entryPointType === 'video')?.uri : null);
  return { id: String(j.id), meetUrl: meet ? String(meet) : null };
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  await fetch(`${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }).catch(() => undefined);
}
