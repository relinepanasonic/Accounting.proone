import crypto from 'crypto';

/**
 * Fonnte incoming-message webhook -> one normalised WhatsApp message.
 * Fonnte posts JSON or form fields: device, sender, message, text, member, name, location, pollname, choices,
 * url, filename, extension, inboxid, isgroup. In a group, "sender" is the group and "member" is the person who wrote;
 * in a private chat "sender" is the person. Field names are read loosely: the raw payload is always stored too,
 * so a field we did not know about can be recovered later.
 */
export interface ParsedWaMessage {
  device: string;
  chatId: string;          // group id, or the contact number for a private chat
  isGroup: boolean;
  groupName: string | null;
  senderPhone: string | null;
  senderName: string | null;
  body: string | null;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'location' | 'poll' | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  externalId: string | null;
  isFromMe: boolean;
  dedupeKey: string;
  sentAt: Date;
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** Digits only, no "@s.whatsapp.net" / "@c.us" / "@g.us" suffix, no "+" and no ":device" part. */
export const cleanPhone = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const digits = s.split('@')[0].split(':')[0].replace(/\D/g, '');
  return digits || null;
};

const isGroupId = (s: string | null) => !!s && (s.includes('@g.us') || /^\d{10,}-\d+$/.test(s) || /^120\d{12,}$/.test(s.split('@')[0]));

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);
const VIDEO = new Set(['mp4', 'mov', 'avi', 'mkv', '3gp', 'webm']);
const AUDIO = new Set(['mp3', 'ogg', 'oga', 'opus', 'm4a', 'wav', 'aac', 'amr']);

export function mediaTypeOf(extension: string | null, url: string | null): ParsedWaMessage['mediaType'] {
  if (!url && !extension) return null;
  const ext = (extension || (url || '').split('?')[0].split('.').pop() || '').toLowerCase().replace(/^\./, '');
  if (IMAGE.has(ext)) return 'image';
  if (VIDEO.has(ext)) return 'video';
  if (AUDIO.has(ext)) return 'audio';
  return url ? 'document' : null;
}

export function parseFonnteWebhook(payload: Record<string, unknown>, now: Date = new Date()): ParsedWaMessage | null {
  const device = cleanPhone(payload.device);
  const sender = str(payload.sender);
  if (!device || !sender) return null;

  const member = cleanPhone(payload.member);
  const group = isGroupId(sender) || str(payload.isgroup) === 'true' || payload.isgroup === true || (!!member && member !== cleanPhone(sender));
  const chatId = group ? sender.split('@')[0] : (cleanPhone(sender) as string);
  const senderPhone = group ? (member || null) : cleanPhone(sender);

  const url = str(payload.url);
  const location = str(payload.location);
  const pollname = str(payload.pollname);
  let mediaType = mediaTypeOf(str(payload.extension), url);
  if (!mediaType && location) mediaType = 'location';
  if (!mediaType && pollname) mediaType = 'poll';

  let body = str(payload.message) ?? str(payload.text);
  if (!body && mediaType === 'location') body = `Location: ${location}`;
  if (!body && mediaType === 'poll') body = `Poll: ${pollname}${payload.choices ? ` (${[].concat(payload.choices as never).join(', ')})` : ''}`;

  // Nothing to keep: no text and no media (e.g. a read receipt or a status ping).
  if (!body && !mediaType) return null;

  const externalId = str(payload.inboxid) ?? str(payload.id);
  const sentAt = now;
  const minute = Math.floor(sentAt.getTime() / 60000);
  const dedupeKey = externalId
    ? `fonnte:${externalId}`
    : crypto.createHash('sha256').update([device, chatId, senderPhone ?? '', body ?? '', url ?? '', minute].join('|')).digest('hex');

  return {
    device,
    chatId,
    isGroup: group,
    groupName: group ? (str(payload.groupname) ?? str(payload.group) ?? null) : (str(payload.name) ?? null),
    senderPhone,
    senderName: str(payload.name),
    body,
    mediaType,
    mediaUrl: url,
    mediaFilename: str(payload.filename),
    externalId,
    isFromMe: senderPhone === device,
    dedupeKey,
    sentAt,
  };
}

/** The webhook may arrive as JSON, as a form post, or as a query string. Always returns a plain object. */
export async function readWebhookPayload(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) {
      const j = await request.json();
      return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
    }
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const f = await request.formData();
      return Object.fromEntries(Array.from(f.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : v.name]));
    }
    const text = await request.text();
    if (text.trim().startsWith('{')) return JSON.parse(text);
    return Object.fromEntries(new URLSearchParams(text));
  } catch {
    return {};
  }
}
