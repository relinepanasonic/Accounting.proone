import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ParsedWaMessage } from '@/lib/wa/parse-webhook';
import { metaChatId } from '@/lib/chat/channel';

/**
 * Meta's webhook for Facebook Page messages (object "page") and Instagram messages (object "instagram"). Pure, so it is tested.
 * Each entry is one of our accounts (entry.id = the Page id or the Instagram account id); each messaging event is one message.
 * An "echo" is a message our account sent: from this app (already saved when we sent it) or typed by a person in Meta's own inbox.
 */
export interface MetaEvent {
  channel: 'instagram' | 'messenger';
  accountId: string;        // our Page / Instagram account
  userId: string;           // the customer
  mid: string;
  text: string | null;
  mediaType: ParsedWaMessage['mediaType'];
  mediaUrl: string | null;
  isEcho: boolean;
  appId: string | null;     // for an echo: which app sent it
  at: Date;
}

const MEDIA: Record<string, ParsedWaMessage['mediaType']> = { image: 'image', video: 'video', audio: 'audio', file: 'document', ig_reel: 'video', reel: 'video', story_mention: 'image' };

export function parseMetaWebhook(body: any): MetaEvent[] {
  const channel = body?.object === 'instagram' ? 'instagram' : body?.object === 'page' ? 'messenger' : null;
  if (!channel) return [];
  const out: MetaEvent[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    const accountId = String(entry?.id ?? '');
    for (const ev of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      const msg = ev?.message;
      const postback = ev?.postback;
      if (!msg && !postback) continue;                                   // read receipts, reactions, typing...
      if (msg?.is_deleted || msg?.is_unsupported) continue;
      const isEcho = msg?.is_echo === true;
      const userId = String((isEcho ? ev?.recipient?.id : ev?.sender?.id) ?? '');
      const mid = String(msg?.mid ?? postback?.mid ?? '');
      if (!accountId || !userId || !mid || userId === accountId) continue;
      const att = Array.isArray(msg?.attachments) ? msg.attachments[0] : null;
      const text = String(msg?.text ?? postback?.title ?? '').trim() || null;
      const mediaType = att ? (MEDIA[String(att.type)] ?? 'document') : null;
      const mediaUrl = att?.payload?.url ? String(att.payload.url) : null;
      if (!text && !mediaType) continue;
      const ts = Number(ev?.timestamp);
      out.push({ channel, accountId, userId, mid, text, mediaType, mediaUrl, isEcho, appId: msg?.app_id != null ? String(msg.app_id) : null, at: Number.isFinite(ts) && ts > 0 ? new Date(ts) : new Date() });
    }
  }
  return out;
}

/**
 * An echo of a message this app sent is skipped (it was saved when sent). An echo from Meta's own inbox (a person replied there) is kept.
 * Without the app id configured, every echo that came through an app is skipped, so nothing is ever saved twice.
 */
export const isOwnEcho = (e: MetaEvent, ourAppId: string | undefined) => e.isEcho && !!e.appId && (!ourAppId || e.appId === ourAppId);

/** The message in the same shape as a WhatsApp one, so it is saved and answered the same way. `devicePhone` is our account's device ("fb:<page id>"). */
export function toParsed(e: MetaEvent, devicePhone: string, name: string | null): ParsedWaMessage {
  const chatId = metaChatId(e.channel, e.userId);
  return {
    device: devicePhone, chatId, isGroup: false, groupName: name, senderPhone: e.isEcho ? null : chatId, senderName: e.isEcho ? null : name,
    body: e.text, mediaType: e.mediaType, mediaUrl: e.mediaUrl, mediaFilename: null, externalId: e.mid, isFromMe: e.isEcho, dedupeKey: `meta:${e.mid}`, sentAt: e.at,
  };
}

/** Meta signs every webhook call with the app secret: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw body). */
export function validSignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header?.startsWith('sha256=')) return false;
  const want = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const got = header.slice(7);
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
