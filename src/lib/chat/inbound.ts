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

/**
 * What happens after a sales chat message is saved, the same for WhatsApp, Instagram and Messenger. One sequence, in this order:
 * keep a lead's picture in our storage, find where the lead came from, then a matching scenario flow, then the normal bot unless a flow
 * already answered. A retried webhook (not new) never triggers it. Never throws.
 */
export async function afterSalesMessage(device: BotDevice, parsed: ParsedWaMessage, res: IngestResult): Promise<void> {
  if (!res.stored || !res.isNew || !res.groupId || device.role !== 'sales') return;
  const groupId = res.groupId;
  if (!parsed.isGroup && parsed.mediaUrl && res.messageId) void archiveInboundMedia(device.workspace_id, groupId, res.messageId, parsed.mediaUrl, parsed.mediaType);
  // "STOP": no more broadcasts for this person, said once; no bot answer to it
  if (!parsed.isGroup && !parsed.isFromMe && isStopWord(parsed.body)) { await optOut(device.workspace_id, groupId, parsed.chatId).catch((e) => console.error('opt-out failed', e)); return; }
  // a short reply about the lead's meeting (YA, GANTI, BATAL, or the number of a new time) is answered here, not by the bot
  if (!parsed.isGroup && !parsed.isFromMe && parsed.body && (await handleMeetingReply(device.workspace_id, groupId, parsed.chatId, parsed.body).catch((e) => { console.error('meeting reply failed', e); return false; }))) return;
  // the number of a time from a follow-up nudge books it
  if (!parsed.isGroup && !parsed.isFromMe && parsed.body && (await handleNudgeReply(device.workspace_id, groupId, parsed.chatId, parsed.body).catch((e) => { console.error('nudge reply failed', e); return false; }))) return;
  if (!parsed.isGroup && !parsed.isFromMe) await captureLeadSource(device.workspace_id, groupId).catch((e) => console.error('lead source failed', e));
  const flow = await runFlowsFor(device, parsed, groupId).catch((e) => { console.error('flows failed', e); return { handled: false }; });
  if (!flow.handled) await runSalesBot(device, parsed, groupId).catch((e) => console.error('sales bot failed', e));
}
