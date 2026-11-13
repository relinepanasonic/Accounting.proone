import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendWhatsApp, type SendResult } from '@/lib/wa/send';
import { sendMeta } from '@/lib/meta/send';
import { chatChannel, metaUserId, replyWindowOpen, windowClosedText } from './channel';

/**
 * Sends text to a sales chat on whichever app it lives in: WhatsApp (Fonnte, the sales number), Instagram or Messenger (Meta, our Page).
 * Instagram and Messenger refuse a message more than 24 hours after the customer's last one, so that is checked first and said clearly.
 */
export async function sendToChat(groupId: string, waId: string, text: string): Promise<SendResult> {
  const channel = chatChannel(waId);
  if (channel === 'whatsapp') {
    if (!process.env.FONNTE_TOKEN_SALES) return { ok: false, parts: 0, detail: 'The sales number is not connected (FONNTE_TOKEN_SALES is missing on the server).' };
    return sendWhatsApp([waId], text, { token: process.env.FONNTE_TOKEN_SALES });
  }
  const token = process.env.META_PAGE_TOKEN;
  if (!token) return { ok: false, parts: 0, detail: 'Instagram and Messenger are not connected (META_PAGE_TOKEN is missing on the server).' };
  const { data: last } = await createAdminClient().from('wa_messages').select('sent_at').eq('group_id', groupId).eq('is_from_me', false).order('sent_at', { ascending: false }).limit(1).maybeSingle();
  if (!replyWindowOpen(channel, (last as any)?.sent_at ?? null)) return { ok: false, parts: 0, detail: windowClosedText(channel) };
  const r = await sendMeta(channel, metaUserId(waId), text, token);
  return { ok: r.ok, parts: r.parts, detail: r.detail };
}
