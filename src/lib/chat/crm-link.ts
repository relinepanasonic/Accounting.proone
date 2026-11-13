/**
 * Chat batch 2, the pure parts (no database, no network): labels, turning a chat into an ERP lead, moving a deal's stage, follow-up reminder
 * times, and checking an image before it is sent. Tested. The rules for leads and stages are the ERP's own (src/app/actions/sales-flow.ts).
 */

// ---------------------------------------------------------------- labels
export const LABEL_COLORS = ['blue', 'green', 'amber', 'red', 'violet', 'teal', 'pink', 'gray'] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export function cleanLabel(input: { name?: unknown; color?: unknown }): { ok: true; value: { name: string; color: LabelColor } } | { ok: false; error: string } {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Give the label a name.' };
  if (name.length > 30) return { ok: false, error: 'Keep the label short (max 30 characters).' };
  const color = (LABEL_COLORS as readonly string[]).includes(String(input.color)) ? (input.color as LabelColor) : 'blue';
  return { ok: true, value: { name, color } };
}

/** The label ids a chat may get: only existing ones, each once, at most 10. */
export function cleanLabelIds(ids: unknown, existing: string[]): string[] {
  const known = new Set(existing);
  return Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter((x) => known.has(x)))).slice(0, 10);
}

// ---------------------------------------------------------------- leads and stages
/** The stages a person can choose. Invoice and Deal are reached through the ERP's invoice and payment flow only. */
export const MANUAL_STAGES = ['Lead', 'Contacted', 'Negotiation', 'Cold Case'] as const;
export const FINANCE_ROLES = ['accounting', 'admin', 'superadmin', 'founder'];

export interface LeadInput { name?: unknown; title?: unknown; value?: unknown; store?: unknown; notes?: unknown; salesmanId?: unknown }
export interface CleanLead { name: string; title: string; value: number; store: string | null; notes: string | null; salesmanId: string | null }

export function cleanLeadInput(input: LeadInput, fallbackName: string): { ok: true; value: CleanLead } | { ok: false; error: string } {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || fallbackName.trim().slice(0, 160);
  if (!name) return { ok: false, error: 'Write the client name.' };
  const title = String(input.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || 'Lead from WhatsApp';
  const raw = String(input.value ?? '').replace(/[^\d]/g, '');
  const value = raw ? Math.min(Number(raw), 1e12) : 0;
  const store = String(input.store ?? '').trim().slice(0, 160) || null;
  const notes = String(input.notes ?? '').trim().slice(0, 1000) || null;
  const sid = String(input.salesmanId ?? '').trim();
  return { ok: true, value: { name, title, value, store, notes, salesmanId: /^[0-9a-f-]{36}$/i.test(sid) ? sid : null } };
}

/** Same rule as the ERP: a salesperson only moves their own (or unowned) deals; finance roles and owners move any. */
export function mayMoveDeal(role: string, userId: string, deal: { salesman_id: string | null; stage: string }): { ok: true } | { ok: false; error: string } {
  if (deal.stage === 'Invoice' || deal.stage === 'Deal') return { ok: false, error: 'An invoiced deal cannot move back. It moves on through the invoice and payment in the ERP.' };
  if (FINANCE_ROLES.includes(role)) return { ok: true };
  if (role === 'sales' && (!deal.salesman_id || deal.salesman_id === userId)) return { ok: true };
  return { ok: false, error: 'This deal belongs to another salesperson.' };
}

export function checkStage(stage: unknown): { ok: true; stage: string } | { ok: false; error: string } {
  const s = String(stage ?? '');
  if ((MANUAL_STAGES as readonly string[]).includes(s)) return { ok: true, stage: s };
  if (s === 'Invoice' || s === 'Deal') return { ok: false, error: s === 'Invoice' ? 'A deal reaches Invoice when Accounting makes its invoice in the ERP.' : 'A deal becomes a Deal when its invoice is paid.' };
  return { ok: false, error: 'Unknown stage.' };
}

// ---------------------------------------------------------------- reminders
const YEAR_MS = 366 * 86400000;

/** A reminder time must be a real moment from about now to a year ahead. */
export function checkDueAt(raw: unknown, now = new Date()): { ok: true; iso: string } | { ok: false; error: string } {
  const t = Date.parse(String(raw ?? ''));
  if (!Number.isFinite(t)) return { ok: false, error: 'Pick a date and time for the reminder.' };
  if (t < now.getTime() - 60_000) return { ok: false, error: 'The reminder time has already passed.' };
  if (t > now.getTime() + YEAR_MS) return { ok: false, error: 'A reminder can be at most a year ahead.' };
  return { ok: true, iso: new Date(t).toISOString() };
}

/** The Jakarta calendar day of a moment, for the ERP task's due date (which has no time). */
export const jakartaDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso));

export type ReminderState = 'overdue' | 'today' | 'later';
export function reminderState(dueAt: string, now = new Date()): ReminderState {
  if (Date.parse(dueAt) <= now.getTime()) return 'overdue';
  return jakartaDay(dueAt) === jakartaDay(now.toISOString()) ? 'today' : 'later';
}

// ---------------------------------------------------------------- images
export const MAX_IMAGE_UPLOAD = 10 * 1024 * 1024;   // what may be uploaded; it is shrunk before sending
export const MAX_SEND_BYTES = 4 * 1024 * 1024;      // Fonnte's limit
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function checkImage(fileName: string, size: number, type: string): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = IMAGE_TYPES[String(type).toLowerCase()] || (/\.(jpe?g|png|webp)$/i.exec(String(fileName))?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? '');
  if (!ext) return { ok: false, error: 'Send a photo or picture (JPG, PNG or WebP).' };
  if (!(size > 0)) return { ok: false, error: 'The file is empty.' };
  if (size > MAX_IMAGE_UPLOAD) return { ok: false, error: 'The picture is too big (max 10 MB).' };
  return { ok: true, ext };
}

/** The file extension to keep an incoming file under, from its media type and link. */
export function mediaExt(mediaType: string | null, url: string | null): string {
  const fromUrl = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(String(url ?? '').split('#')[0])?.[1]?.toLowerCase();
  if (fromUrl && /^(jpe?g|png|webp|gif|heic|mp4|mov|3gp|ogg|oga|opus|mp3|m4a|aac|amr|wav|pdf|docx?|xlsx?|pptx?|zip|txt|csv)$/.test(fromUrl)) return fromUrl === 'jpeg' ? 'jpg' : fromUrl;
  return mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'ogg' : 'bin';
}
