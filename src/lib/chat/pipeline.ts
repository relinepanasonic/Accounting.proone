import { createAdminClient } from '@/lib/api/supabase-admin';
import { isForward, LOCKED_STAGES, stageLabel } from '@/lib/sales/flow';
import { phoneTail } from './channel';

/**
 * The ERP deal of a chat, and the automatic moves. One pipeline for the ERP and the chat dashboard: both read and write crm_deals, so there is
 * nothing to sync. Everything automatic (the bot, a booking, a finished meeting) only ever moves a deal FORWARD, never touches a deal that is
 * with Accounting (Invoice Requested, Invoice Sent, Active Client), and leaves a note in the chat saying what moved it.
 */
export interface ChatDeal { id: string; stage: string; clientId: string }

/** The newest deal that is not Lost of the client with this chat's phone number, or null. */
export async function findChatDeal(ws: string, waId: string): Promise<ChatDeal | null> {
  const t = phoneTail(waId);
  if (t.length < 8) return null;
  const db = createAdminClient();
  const { data: clients } = await db.from('clients').select('id, phone').eq('workspace_id', ws).not('phone', 'is', null).limit(3000);
  const mine = ((clients || []) as Array<{ id: string; phone: string }>).filter((c) => phoneTail(c.phone) === t).map((c) => c.id);
  if (!mine.length) return null;
  const { data: deals } = await db.from('crm_deals').select('id, stage, client_id').in('client_id', mine).neq('stage', 'Cold Case').order('created_at', { ascending: false }).limit(1);
  const d = (deals || [])[0] as any;
  return d ? { id: d.id, stage: d.stage, clientId: d.client_id } : null;
}

/** May something automatic move a deal from `from` to `to`? Only forward, and never a deal that is with Accounting. */
export const mayAutoMove = (from: string, to: string) => !LOCKED_STAGES.includes(from) && !LOCKED_STAGES.includes(to) && isForward(from, to);

/**
 * Moves the chat's deal forward to `to` (when it is further along than where it stands), with a team note. Returns the stage the deal is in after,
 * or null when the chat has no deal. Never throws.
 */
export async function advanceChatDeal(ws: string, groupId: string | null, waId: string, to: string, why: string): Promise<string | null> {
  try {
    const deal = await findChatDeal(ws, waId);
    if (!deal) return null;
    if (!mayAutoMove(deal.stage, to)) return deal.stage;
    const db = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await db.from('crm_deals').update({ stage: to, stage_changed_at: now, updated_at: now }).eq('id', deal.id).eq('stage', deal.stage);
    if (error) return deal.stage;
    if (groupId) await db.from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: null, author_name: 'Pipeline', body: `Pipeline: ${stageLabel(deal.stage)} ke ${stageLabel(to)} (${why}).` }).then(() => undefined, () => undefined);
    return to;
  } catch (e) { console.error('advance deal failed', e); return null; }
}
