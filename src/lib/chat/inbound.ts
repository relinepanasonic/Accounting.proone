import type { ParsedWaMessage } from '@/lib/wa/parse-webhook';
import type { IngestResult } from '@/lib/wa/ingest';
import { runSalesBot, type BotDevice } from '@/lib/wa/bot/run';
import { captureLeadSource } from './sources';
import { runFlowsFor } from './flows';
import { archiveInboundMedia } from './crm-data';
import { isStopWord } from './broadcast-rules';
import { optOut } from './broadcasts';
import { handleMeetingReply } from './meetings';
import { handleNudgeReply } from './nudges';
import { autoStage } from './pipeline';
import { notALeadReason } from './not-a-lead';
import { archiveJunkLead } from './junk-leads';
import { doNotContact } from './do-not-contact';
import { handleStaffMessage, staffOf } from './staff-commands';
import { markLostLead } from './lost-lead';
import { createAdminClient } from '@/lib/api/supabase-admin';

/**
 * What happens after a sales chat message is saved, the same for WhatsApp, Instagram and Messenger. One sequence, in this order:
 * keep a lead's picture in our storage, find where the lead came from, then a matching scenario flow, then the normal bot unless a flow
 * already answered. A retried webhook (not new) never triggers it. Never throws.
 */
export async function afterSalesMessage(device: BotDevice, parsed: ParsedWaMessage, res: IngestResult): Promise<void> {
  if (!res.stored || !res.isNew || !res.groupId || device.role !== 'sales') return;
  const groupId = res.groupId;
  if (!parsed.isGroup && parsed.mediaUrl && res.messageId) void archiveInboundMedia(device.workspace_id, groupId, res.messageId, parsed.mediaUrl, parsed.mediaType);
  // a team number (a salesperson or the BOD): "Hi Fefe" + the template enters a lead or changes its pipeline; the chat itself is never a lead
  if (!parsed.isGroup && !parsed.isFromMe) {
    const staff = await staffOf(device.workspace_id, parsed.chatId).catch(() => null);
    if (staff) { await handleStaffMessage(device.workspace_id, groupId, parsed.chatId, parsed.body || '', staff); return; }
  }
  // not a lead: a verification code or a company's automatic greeting, or a chat marked "not a lead": nothing answers it and no lead is made
  if (!parsed.isGroup && !parsed.isFromMe) {
    const db = createAdminClient();
    const { data: st } = await db.from('chat_state').select('ignored').eq('group_id', groupId).maybeSingle();
    if ((st as any)?.ignored) return;
    const { data: g } = await db.from('wa_groups').select('name').eq('id', groupId).maybeSingle();
    const why = notALeadReason(parsed.body, (g as any)?.name);
    if (why) {
      const now = new Date().toISOString();
      await db.from('chat_state').upsert({ group_id: groupId, workspace_id: device.workspace_id, ignored: true, ignored_reason: why, resolved_at: now, updated_at: now }, { onConflict: 'group_id' });
      await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: device.workspace_id, status: 'off', reason: why, updated_at: now }, { onConflict: 'group_id' });
      await archiveJunkLead(device.workspace_id, groupId, parsed.chatId);      // a lead the automation made before the filter knew: archived
      return;
    }
  }
  // "STOP": no more broadcasts for this person, said once; no bot answer to it
  if (!parsed.isGroup && !parsed.isFromMe && isStopWord(parsed.body)) { await optOut(device.workspace_id, groupId, parsed.chatId).catch((e) => console.error('opt-out failed', e)); return; }
  // a clear "no" ("jangan ganggu saya", "tidak minat"): never contacted again, the deal goes to Lost, the bot is quiet
  if (!parsed.isGroup && !parsed.isFromMe && doNotContact(parsed.body)) { await markLostLead(device.workspace_id, groupId, parsed.chatId, 'kakak minta tidak dihubungi lagi / tidak berminat'); return; }
  // a short reply about the lead's meeting (YA, GANTI, BATAL, or the number of a new time) is answered here, not by the bot
  if (!parsed.isGroup && !parsed.isFromMe && parsed.body && (await handleMeetingReply(device.workspace_id, groupId, parsed.chatId, parsed.body).catch((e) => { console.error('meeting reply failed', e); return false; }))) return;
  // the number of a time from a follow-up nudge books it
  if (!parsed.isGroup && !parsed.isFromMe && parsed.body && (await handleNudgeReply(device.workspace_id, groupId, parsed.chatId, parsed.body).catch((e) => { console.error('nudge reply failed', e); return false; }))) return;
  if (!parsed.isGroup && !parsed.isFromMe) await captureLeadSource(device.workspace_id, groupId).catch((e) => console.error('lead source failed', e));
  // the lead's message can move its deal in the ERP pipeline (name, replies, price questions, "mau daftar", "tidak jadi")
  if (!parsed.isGroup && !parsed.isFromMe) await autoStage(device.workspace_id, groupId, parsed.chatId, { text: parsed.body || '' });
  const flow = await runFlowsFor(device, parsed, groupId).catch((e) => { console.error('flows failed', e); return { handled: false }; });
  if (!flow.handled) await runSalesBot(device, parsed, groupId).catch((e) => console.error('sales bot failed', e));
}
