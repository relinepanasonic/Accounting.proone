import { META_MAX_CHARS } from '@/lib/chat/channel';
import { chunkMessage, type SendResult } from '@/lib/wa/send';

/**
 * Sends text to a customer on Instagram or Facebook Messenger through Meta's Send API, as our Page. The Page token also covers the Instagram
 * account linked to that Page. Server-side only: the token is a secret.
 */
export const GRAPH = 'https://graph.facebook.com/v23.0';

/** Meta's error, said the way the team reads it. */
export function metaErrorText(err: any): string {
  const code = Number(err?.code); const sub = Number(err?.error_subcode);
  if ((code === 10 && sub === 2018278) || sub === 2534022) return 'Outside the 24-hour window: the customer has to write again first.';
  if (code === 551 || sub === 1545041) return 'This person cannot get messages right now (they may have blocked the account).';
  if (code === 190) return 'The Meta connection expired. Make a new Page token and put it in META_PAGE_TOKEN.';
  if (code === 200 || code === 10) return 'Meta refused: the app is missing a permission for messages.';
  return String(err?.message || 'Meta did not accept the message.').slice(0, 200);
}

export async function sendMeta(channel: 'instagram' | 'messenger', userId: string, text: string, token: string, fetchImpl: typeof fetch = fetch): Promise<SendResult & { mids: string[] }> {
  const parts = chunkMessage(text, META_MAX_CHARS[channel]);
  const mids: string[] = [];
  for (const part of parts) {
    try {
      const res = await fetchImpl(`${GRAPH}/me/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipient: { id: userId }, messaging_type: 'RESPONSE', message: { text: part } }),
        signal: AbortSignal.timeout(15000),
      });
      const j: any = await res.json().catch(() => null);
      if (!res.ok || j?.error) return { ok: false, parts: mids.length, detail: metaErrorText(j?.error), mids };
      if (j?.message_id) mids.push(String(j.message_id));
    } catch (e: any) {
      return { ok: false, parts: mids.length, detail: `Could not reach Meta: ${String(e?.message || e).slice(0, 120)}`, mids };
    }
  }
  return { ok: true, parts: parts.length, detail: 'sent', mids };
}

/** Shows "typing..." to the customer while the bot writes (best effort: never fails the reply). Meta hides it after ~20 s or when our message arrives. */
export async function sendTyping(userId: string, token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    await fetchImpl(`${GRAPH}/me/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipient: { id: userId }, sender_action: 'typing_on' }), signal: AbortSignal.timeout(4000),
    });
  } catch { /* only a nicety */ }
}

/** The customer's name, for a new chat (best effort: null when Meta does not give it). */
export async function metaProfileName(channel: 'instagram' | 'messenger', userId: string, token: string): Promise<string | null> {
  try {
    const fields = channel === 'instagram' ? 'name,username' : 'first_name,last_name';
    const res = await fetch(`${GRAPH}/${encodeURIComponent(userId)}?fields=${fields}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j: any = await res.json();
    const name = channel === 'instagram' ? (j?.name || (j?.username ? `@${j.username}` : '')) : [j?.first_name, j?.last_name].filter(Boolean).join(' ');
    return String(name || '').trim().slice(0, 80) || null;
  } catch { return null; }
}

/** Our Page and the Instagram account linked to it, read with the Page token (for "Connect"). */
export async function metaAccounts(token: string): Promise<{ ok: true; page: { id: string; name: string }; instagram: { id: string; username: string } | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${GRAPH}/me?fields=id,name,instagram_business_account{id,username}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    const j: any = await res.json().catch(() => null);
    if (!res.ok || j?.error || !j?.id) return { ok: false, error: metaErrorText(j?.error) };
    const ig = j.instagram_business_account;
    return { ok: true, page: { id: String(j.id), name: String(j.name || 'Facebook Page') }, instagram: ig?.id ? { id: String(ig.id), username: String(ig.username || '') } : null };
  } catch (e: any) {
    return { ok: false, error: `Could not reach Meta: ${String(e?.message || e).slice(0, 120)}` };
  }
}

/** Asks Meta to send this Page's messages to our webhook (the Page must subscribe the app once). */
export async function subscribePage(pageId: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    const j: any = await res.json().catch(() => null);
    return res.ok && j?.success ? { ok: true } : { ok: false, error: metaErrorText(j?.error) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 120) };
  }
}
