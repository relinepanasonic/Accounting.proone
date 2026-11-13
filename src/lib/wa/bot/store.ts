import { createAdminClient } from '@/lib/api/supabase-admin';

/**
 * Saves a message OUR side sent automatically (the bot, or a scenario flow) in the chat history. Fonnte does not send our own messages back to the
 * webhook, so without this a chat the bot had answered still looked unanswered, and the conversation looked one-sided in the dashboard.
 * The `raw.bot` flag lets the dashboard show it as the bot's. Never throws: failing to save the copy must not undo a message that was sent.
 */
export async function recordBotMessage(ws: string, groupId: string, devicePhone: string | null, text: string, source: 'bot' | 'flow' = 'bot'): Promise<void> {
  try {
    const db = createAdminClient();
    const at = new Date().toISOString();
    await db.from('wa_messages').insert({
      workspace_id: ws, group_id: groupId, sender_phone: devicePhone, body: text, is_from_me: true,
      dedupe_key: `${source}:${crypto.randomUUID()}`, sent_at: at, source, raw: { bot: true },
    });
    await db.from('wa_groups').update({ last_message_at: at }).eq('id', groupId);
  } catch (e) {
    console.error('recordBotMessage failed', e);
  }
}
