/**
 * The request Dashboard Prof and Reline send to the ERP to preview or send the weekly report of ONE store to its client group.
 * Pure: it only checks and cleans the body.
 *   { source: "dashboard" | "reline", store, workspace?, week?: "YYYY-MM-DD" (a Monday; default: the last full week),
 *     action: "preview" | "send", resend?: boolean, sentBy?: string }
 */
export interface AppWeeklyRequest {
  source: 'dashboard' | 'reline';
  store: string;
  workspace: string;
  week: string | null;
  action: 'preview' | 'send';
  resend: boolean;
  sentBy: string;
}

export function parseAppWeeklyRequest(body: unknown): { ok: true; value: AppWeeklyRequest } | { ok: false; error: string } {
  const b: any = body && typeof body === 'object' ? body : {};
  const source = b.source === 'dashboard' || b.source === 'reline' ? b.source : null;
  if (!source) return { ok: false, error: 'source must be "dashboard" or "reline".' };
  const store = String(b.store ?? '').trim();
  if (!store || store.length > 200) return { ok: false, error: 'store is required (the store name, or the dealer name for Reline).' };
  const workspace = String(b.workspace ?? '').trim();
  if (workspace.length > 100) return { ok: false, error: 'workspace is too long.' };
  let week: string | null = null;
  if (b.week !== undefined && b.week !== null && b.week !== '') {
    week = String(b.week);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || Number.isNaN(Date.parse(week)) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 1) return { ok: false, error: 'week must be the Monday of the week, as YYYY-MM-DD.' };
  }
  const action = b.action === 'send' ? 'send' : b.action === 'preview' || b.action === undefined ? 'preview' : null;
  if (!action) return { ok: false, error: 'action must be "preview" or "send".' };
  return { ok: true, value: { source, store, workspace, week, action, resend: b.resend === true, sentBy: String(b.sentBy ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) } };
}
