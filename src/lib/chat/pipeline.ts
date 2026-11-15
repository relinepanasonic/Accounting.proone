import { createAdminClient } from '@/lib/api/supabase-admin';
import { isForward, LOCKED_STAGES, stageLabel } from '@/lib/sales/flow';
import { phoneTail } from './channel';
import { createLeadFromChat } from './crm-data';
import { stageFor, wordsOf, parseWords, type StageWords } from './stage-rules';

/**
 * The ERP deal of a chat, and the automatic moves. One pipeline for the ERP and the chat dashboard: both read and write crm_deals, so there is
 * nothing to sync. Everything automatic (the bot, a booking, a finished meeting) only ever moves a deal FORWARD, never touches a deal that is
 * with Accounting (Invoice Requested, Invoice Sent, Active Client), and leaves a note in the chat saying what moved it.
 */
export interface ChatDeal { id: string; stage: string; clientId: string }

/** The newest deal that is not Lost of the client with this chat's phone number, or null. */
export async function findChatDeal(ws: string, waId: string, groupId?: string | null): Promise<ChatDeal | null> {
  const db = createAdminClient();
  // the deal this chat is linked to (Instagram and Messenger have no phone number to match)
  if (groupId) {
    const { data: st } = await db.from('chat_state').select('deal_id').eq('group_id', groupId).maybeSingle();
    const id = (st as any)?.deal_id;
    if (id) {
      const { data: d } = await db.from('crm_deals').select('id, stage, client_id').eq('id', id).neq('stage', 'Cold Case').maybeSingle();
      if (d) return { id: (d as any).id, stage: (d as any).stage, clientId: (d as any).client_id };
    }
  }
  const t = phoneTail(waId);
  if (t.length < 8) return null;
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
export async function advanceChatDeal(ws: string, groupId: string | null, waId: string, to: string, why: string, known?: ChatDeal | null): Promise<string | null> {
  try {
    const deal = known ?? (await findChatDeal(ws, waId, groupId));
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

// ---------------------------------------------------------------- the AI puts leads in the pipeline
export interface StageSettings { auto: boolean; words: StageWords }

export async function stageSettings(ws: string): Promise<StageSettings> {
  const { data } = await createAdminClient().from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle();
  const r: any = data || {};
  return { auto: r.stage_auto === true, words: wordsOf(r.stage_words) };
}

export async function saveStageSettings(ws: string, p: { auto?: unknown; words?: unknown }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const row: Record<string, unknown> = { workspace_id: ws, updated_at: new Date().toISOString() };
  if (typeof p.auto === 'boolean') row.stage_auto = p.auto;
  if (p.words && typeof p.words === 'object') { const w = p.words as Record<string, unknown>; row.stage_words = { warm: parseWords(w.warm), negotiation: parseWords(w.negotiation), lost: parseWords(w.lost) }; }
  const { error } = await createAdminClient().from('wa_bot_config').upsert(row, { onConflict: 'workspace_id' });
  return error ? { ok: false, status: 500, error: /column/.test(error.message) ? 'The pipeline automation is not in the database yet: run the SQL first.' : error.message } : { ok: true };
}

export interface AutoContext {
  text?: string;                 // the lead's latest message
  lead?: { name?: string; store?: string } | null;   // what the bot has collected so far (newer than the saved copy)
  offerLabels?: string[];        // the free times the bot may have just offered
  reply?: string;                // what the bot is about to say
  deckSent?: boolean;
}

const pipelineNote = (ws: string, groupId: string, body: string) =>
  createAdminClient().from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: null, author_name: 'Pipeline', body }).then(() => undefined, () => undefined);

/**
 * Called after every message of a lead (and after the bot's answer). Makes the lead in the ERP when the name or the store is known (for the salesperson
 * of the chat, else the one set in Jadwal), then moves the deal forward to the stage the chat shows. Off until the switch is on. Never throws.
 */
export async function autoStage(ws: string, groupId: string, waId: string, ctx: AutoContext = {}): Promise<string | null> {
  try {
    const db = createAdminClient();
    const [ss, { data: cfg }, { data: st }, { data: bot }, { data: grp }] = await Promise.all([
      stageSettings(ws),
      db.from('wa_bot_config').select('meet_owner_id, meet_owner_name').eq('workspace_id', ws).maybeSingle(),
      db.from('chat_state').select('assigned_to, assigned_name, deal_id').eq('group_id', groupId).maybeSingle(),
      db.from('wa_bot_chats').select('lead').eq('group_id', groupId).maybeSingle(),
      db.from('wa_groups').select('name').eq('id', groupId).maybeSingle(),
    ]);
    if (!ss.auto) return null;
    const lead = { ...(((bot as any)?.lead || {}) as { name?: string; store?: string }), ...Object.fromEntries(Object.entries(ctx.lead || {}).filter(([, v]) => v)) };
    const gname = String((grp as any)?.name || '').trim();
    const name = String(lead.name || (/^[\d+ ()-]*$/.test(gname) ? '' : gname) || '').trim();
    const store = String(lead.store || '').trim();

    let deal = await findChatDeal(ws, waId, groupId);
    // a lead that went Lost and writes again comes back as Contacted
    if (!deal && ctx.text && (st as any)?.deal_id) {
      const { data: lost } = await db.from('crm_deals').select('id').eq('id', (st as any).deal_id).eq('stage', 'Cold Case').maybeSingle();
      if (lost && stageFor({ hasName: !!name, hasStore: !!store, replied: true, text: ctx.text, offeredTimes: false, deckSent: false }, ss.words).stage !== 'Cold Case') {
        const now = new Date().toISOString();
        await db.from('crm_deals').update({ stage: 'Contacted', stage_changed_at: now, updated_at: now }).eq('id', (lost as any).id);
        await pipelineNote(ws, groupId, 'Pipeline: Lost ke Contacted (kakak menulis lagi).');
        return 'Contacted';
      }
    }
    if (!deal) {
      if (!name && !store) return null;
      const ownerId = (st as any)?.assigned_to || (cfg as any)?.meet_owner_id;
      if (!ownerId) return null;      // nobody to own the lead yet: pick a salesperson in Jadwal
      const ownerName = (st as any)?.assigned_to ? String((st as any).assigned_name || 'Sales') : String((cfg as any)?.meet_owner_name || 'Sales');
      const made = await createLeadFromChat(ws, groupId, { name: name || undefined, title: 'Lead dari chat', store: store || undefined, salesmanId: ownerId }, { userId: ownerId, name: ownerName, role: 'founder' });
      if (!made.ok) { console.error('auto lead failed', made.error); return null; }
      deal = { id: made.dealId, stage: 'Lead', clientId: made.clientId };
      await pipelineNote(ws, groupId, `Pipeline: lead baru dibuat di ERP untuk ${ownerName}.`);
    }

    const [{ count: inbound }, { data: offered }] = await Promise.all([
      db.from('wa_messages').select('id', { count: 'exact', head: true }).eq('group_id', groupId).eq('is_from_me', false),
      db.from('chat_nudges').select('offer_at').eq('group_id', groupId).maybeSingle(),
    ]);
    const said = ctx.reply || '';
    const call = stageFor({
      hasName: !!name, hasStore: !!store, replied: (inbound ?? 0) >= 2, text: ctx.text || '',
      offeredTimes: !!(offered as any)?.offer_at || (ctx.offerLabels || []).some((l) => l && said.includes(l)),
      deckSent: !!ctx.deckSent,
    }, ss.words);
    if (!mayAutoMove(deal.stage, call.stage)) return deal.stage;
    return (await advanceChatDeal(ws, groupId, waId, call.stage, call.why, deal)) ?? deal.stage;
  } catch (e) { console.error('auto stage failed', e); return null; }
}

/**
 * A lead who got every follow-up and stayed quiet for 3 days after the last one goes to Lost (a person can still bring it back).
 * Run by the clock. Returns how many deals moved.
 */
export async function runLostSweep(now = new Date()): Promise<number> {
  try {
    const db = createAdminClient();
    const { data: rows } = await db.from('chat_nudges').select('group_id, workspace_id, sent, last_sent_at').lte('last_sent_at', new Date(now.getTime() - 3 * 86400000).toISOString()).gte('last_sent_at', new Date(now.getTime() - 30 * 86400000).toISOString()).gte('sent', 1).limit(100);
    let moved = 0;
    for (const r of (rows || []) as any[]) {
      const { data: cfg } = await db.from('wa_bot_config').select('nudge_hours, stage_auto').eq('workspace_id', r.workspace_id).maybeSingle();
      if ((cfg as any)?.stage_auto !== true) continue;
      const need = String((cfg as any)?.nudge_hours || '24,72').split(',').filter(Boolean).length;
      if ((r.sent ?? 0) < need) continue;
      const { data: g } = await db.from('wa_groups').select('wa_id').eq('id', r.group_id).maybeSingle();
      const { data: back } = await db.from('wa_messages').select('id').eq('group_id', r.group_id).eq('is_from_me', false).gt('sent_at', r.last_sent_at).limit(1);
      if (back?.length || !g) continue;
      if ((await advanceChatDeal(r.workspace_id, r.group_id, String((g as any).wa_id), 'Cold Case', 'tidak ada balasan setelah semua follow-up')) === 'Cold Case') moved++;
    }
    return moved;
  } catch (e) { console.error('lost sweep failed', e); return 0; }
}
