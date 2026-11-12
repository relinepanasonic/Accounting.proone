import type { WaMsg, WaPerson } from './stats';

/** Pure helpers for the WA daily report: the chat transcript Claude reads, and reading its answer back. */

export const MIN_MESSAGES = 3;           // a chat with fewer messages than this is skipped (not worth a report)
export const MAX_TRANSCRIPT_CHARS = 60000;

/** The Jakarta calendar day (YYYY-MM-DD) of a moment. */
export const jakartaDate = (d: Date = new Date()): string => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

const hhmm = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(11, 16);
const dayHm = (iso: string) => `${new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(5, 10)} ${hhmm(iso)}`;

/**
 * "[11-12 09:41] Sari (sales, +6281...): text" per message, oldest first. When it is too long the OLDEST lines
 * are dropped (the latest matter most) and the first line says how many.
 */
export function buildTranscript(msgs: WaMsg[], byPhone: Map<string, WaPerson>, maxChars = MAX_TRANSCRIPT_CHARS): string {
  const lines = msgs.map((m) => {
    const p = m.sender_phone ? byPhone.get(m.sender_phone) : undefined;
    const who = m.is_from_me ? 'our device' : p?.name || m.sender_name || 'unknown';
    const tag = [m.is_from_me ? null : p?.role || null, m.sender_phone ? `+${m.sender_phone}` : null].filter(Boolean).join(', ');
    const media = m.media_type ? `[${m.media_type}] ` : '';
    return `[${dayHm(m.sent_at)}] ${who}${tag ? ` (${tag})` : ''}: ${media}${(m.body || '').replace(/\s+/g, ' ').trim()}`;
  });
  let total = 0;
  let start = lines.length;
  while (start > 0 && total + lines[start - 1].length + 1 <= maxChars) { start--; total += lines[start].length + 1; }
  const kept = lines.slice(start);
  return start > 0 ? `(${start} older messages left out because the chat is long)\n${kept.join('\n')}` : kept.join('\n');
}

export const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          owner_phone: { type: 'string' },
          due_date: { type: 'string' },
        },
        required: ['title', 'detail', 'owner_phone', 'due_date'],
      },
    },
  },
  required: ['summary', 'action_items'],
} as const;

export const DIGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { summary: { type: 'string' } },
  required: ['summary'],
} as const;

export const REPORT_SYSTEM =
  'You are the operations analyst of an Indonesian online-business company. You read WhatsApp chats of the team and customers (Indonesian or English) and write short, factual management reports in English. Never invent facts: if something is not in the chat, leave it out.';

export function groupPrompt(groupName: string, date: string, transcript: string): string {
  return `Report for the WhatsApp chat "${groupName}", day ${date} (Jakarta time). Lines look like: [MM-DD HH:mm] name (role, +phone): message. "our device" is the company number itself.

Write "summary" as PLAIN TEXT (no markdown symbols, no asterisks, no #). Use these section titles, each on its own line in CAPITALS, then short "- " lines. Skip a section that has nothing:
OVERVIEW (messages, who was active, busiest time, one line on the mood)
KEY TOPICS
WAITING FOR A REPLY (what a customer or colleague asked that nobody answered; name the person and the time)
ORDERS, PAYMENTS, DEADLINES
RISKS OR COMPLAINTS
NEXT STEPS (most urgent first)

Keep the whole summary under 350 words.

"action_items" are concrete follow-ups someone must still do: a short title, one line of detail, the owner's phone digits only as written in the chat (empty string if unclear), and a due date as YYYY-MM-DD only when the chat states one (empty string otherwise). At most 8, most important first. Do not list things already finished.

CHAT:
${transcript}`;
}

export function digestPrompt(date: string, parts: { name: string; count: number; summary: string }[]): string {
  return `Day ${date}. Below are the reports of ${parts.length} WhatsApp chats of the company. Write "summary" as PLAIN TEXT (no markdown symbols), under 250 words, for the owner: the three to five things that matter most today across ALL chats, what is waiting for a reply and in which chat, and any risk. Start with one line: "${parts.length} chats, ${parts.reduce((n, p) => n + p.count, 0)} messages."

${parts.map((p) => `=== ${p.name} (${p.count} messages)\n${p.summary}`).join('\n\n')}`;
}

export interface ActionItemDraft { title: string; detail: string | null; owner_phone: string | null; due_date: string | null }

/** Keeps only usable items and cleans the fields the model filled in. */
export function cleanActionItems(raw: unknown, max = 8): ActionItemDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: ActionItemDraft[] = [];
  for (const r of raw) {
    const title = typeof r?.title === 'string' ? r.title.trim().slice(0, 200) : '';
    if (!title) continue;
    const phone = typeof r?.owner_phone === 'string' ? r.owner_phone.replace(/\D/g, '') : '';
    const due = typeof r?.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.due_date) && !Number.isNaN(Date.parse(r.due_date)) ? r.due_date : null;
    out.push({
      title,
      detail: typeof r?.detail === 'string' && r.detail.trim() ? r.detail.trim().slice(0, 500) : null,
      owner_phone: phone.length >= 8 ? phone : null,
      due_date: due,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** One WhatsApp-ready text for Make to send: the digest first, then each chat. */
export function whatsappText(date: string, digest: string | null, reports: { name: string; count: number; summary: string }[]): string {
  const parts = [`*WA REPORT ${date}*`];
  if (digest) parts.push(digest.trim());
  for (const r of reports) parts.push(`*${r.name}* (${r.count} msgs)\n${r.summary.trim()}`);
  return parts.join('\n\n');
}
