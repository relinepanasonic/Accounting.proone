import { createAdminClient } from '@/lib/api/supabase-admin';
import { askWorker } from '@/lib/ai/providers';
import { sendWhatsApp } from '../send';
import type { ParsedWaMessage } from '../parse-webhook';
import { decideBot, inOpenHours, isBotEcho, needsHuman } from './decide';
import { buildBotPrompt, parseBotAnswer, type BotTurn } from './prompt';

/**
 * The sales bot, end to end. Called by the webhook AFTER the message is saved (and after the answer to Fonnte), for private chats on a
 * "sales" number only. Everything it decides is in decide.ts; this file reads and writes the database and talks to the model and Fonnte.
 * The reply goes out from the sales number's own token (FONNTE_TOKEN_SALES). A failure never reaches the customer: the chat is handed to a person.
 */

export interface BotDevice { id: string; workspace_id: string; phone: string; role?: string }

const MODEL = { provider: 'gemini' as const, model: 'gemini-3.8-flash' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runSalesBot(device: BotDevice, m: ParsedWaMessage, groupId: string): Promise<{ done: string }> {
  if (device.role !== 'sales' || m.isGroup) return { done: 'not-applicable' };
  const db = createAdminClient();
  const ws = device.workspace_id;

  const [{ data: cfg }, { data: chat }, { data: recent }] = await Promise.all([
    db.from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle(),
    db.from('wa_bot_chats').select('status, replies, lead').eq('group_id', groupId).maybeSingle(),
    db.from('wa_bot_log').select('reply, created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(5),
  ]);
  if (!cfg?.enabled) return { done: 'bot-off' };

  const lastReplies = (recent || []).filter((r: any) => Date.now() - new Date(r.created_at).getTime() < 15 * 60000).map((r: any) => String(r.reply || ''));
  const decision = decideBot({
    enabled: true, deviceRole: 'sales', isGroup: m.isGroup, isFromMe: m.isFromMe, body: m.body, mediaType: m.mediaType,
    state: { status: (chat?.status as any) ?? null, replies: chat?.replies ?? 0 }, maxReplies: cfg.max_replies ?? 4,
    echoOfBot: m.isFromMe && isBotEcho(m.body, lastReplies),
  });

  const setState = (patch: Record<string, unknown>) => db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, updated_at: new Date().toISOString(), ...patch }, { onConflict: 'group_id' });

  if (decision.action === 'takeover' || decision.action === 'limit') {
    await setState({ status: 'human', reason: decision.reason, replies: chat?.replies ?? 0, lead: chat?.lead ?? null });
    return { done: decision.action };
  }
  if (decision.action === 'skip') return { done: decision.reason };

  // Two messages in a row must not get two answers.
  if (lastReplies.length && recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 10000) return { done: 'just-answered' };

  const replyNo = (chat?.replies ?? 0) + 1;
  const logBase = { workspace_id: ws, group_id: groupId, in_reply_to: (m.body || `(${m.mediaType})`).slice(0, 500) };
  const handToPerson = async (reason: string, detail: string) => {
    await setState({ status: 'human', reason, replies: chat?.replies ?? 0, lead: chat?.lead ?? null });
    await db.from('wa_bot_log').insert({ ...logBase, ok: false, handoff: true, detail });
  };

  // What has been said in this chat so far (the new message is already saved).
  const { data: msgs } = await db.from('wa_messages').select('body, media_type, is_from_me, sent_at').eq('group_id', groupId).order('sent_at', { ascending: false }).limit(12);
  const history: BotTurn[] = (msgs || []).reverse().map((x: any) => ({ from: x.is_from_me ? 'team' : 'lead', text: x.body || `(${x.media_type || 'pesan'})`, }));

  const { system, prompt } = buildBotPrompt({
    persona: cfg.persona_name, company: cfg.company_name, knowledge: cfg.knowledge || '', history, replyNo,
    inHours: inOpenHours(new Date(), cfg.hours_from || '08:00', cfg.hours_to || '21:00'),
  });

  let answer; let usage: { model: string; tokensIn: number; tokensOut: number };
  try {
    const out = await askWorker({ ...MODEL, system, prompt });
    usage = out;
    answer = parseBotAnswer(out.text, cfg.knowledge || '');
  } catch (e: any) {
    await handToPerson('The bot could not answer.', `Model error: ${String(e?.message || e).slice(0, 200)}`);
    return { done: 'model-error' };
  }
  if (!answer) { await handToPerson('The bot could not answer.', 'The model answer could not be read.'); return { done: 'bad-answer' }; }

  // The words that always need a person decide, whatever the model said.
  const forced = needsHuman(m.body);
  const handoff = answer.handoff || !!forced;
  const reason = forced || answer.reason || (handoff ? 'The bot asked for a person.' : '');

  // A short pause before answering, so it does not read as a machine.
  await sleep(3000 + Math.floor(Math.random() * 5000));

  const sent = await sendWhatsApp([m.chatId], answer.reply, { token: process.env.FONNTE_TOKEN_SALES });
  await db.from('wa_bot_log').insert({ ...logBase, reply: answer.reply, handoff, ok: sent.ok, detail: sent.detail.slice(0, 300), model: usage.model, tokens_in: usage.tokensIn, tokens_out: usage.tokensOut });
  if (!sent.ok) { await setState({ status: 'human', reason: 'The bot could not send.', replies: chat?.replies ?? 0, lead: chat?.lead ?? null }); return { done: 'send-failed' }; }

  const lead = { ...(chat?.lead as object | null ?? {}), ...Object.fromEntries(Object.entries(answer.lead).filter(([, v]) => v)) };
  await setState({ status: handoff ? 'human' : 'bot', reason: handoff ? reason : null, replies: replyNo, lead });
  return { done: handoff ? 'replied-and-handed-over' : 'replied' };
}
