import { createAdminClient } from '@/lib/api/supabase-admin';
import { LOCKED_STAGES } from '@/lib/sales/flow';
import { optOut } from './broadcasts';

/**
 * The lead said no or asked not to be contacted. Said once, politely; then nothing is ever sent to this number by us: no follow-up, no broadcast (the
 * opt-out list), the bot goes quiet, and the deal goes to Lost (unless it is already with Accounting: an invoice, a payment). Never throws.
 */
export async function markLostLead(ws: string, groupId: string, waId: string, why: string): Promise<void> {
  try {
    const db = createAdminClient();
    const now = new Date().toISOString();
    const { data: had } = await db.from('chat_optouts').select('wa_id').eq('workspace_id', ws).eq('wa_id', waId).maybeSingle();
    if (had) await db.from('chat_optouts').upsert({ workspace_id: ws, wa_id: waId, reason: why.slice(0, 200) }, { onConflict: 'workspace_id,wa_id' });
    else await optOut(ws, groupId, waId);                       // the opt-out and the one polite goodbye
    await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'off', reason: `Lost: ${why}`.slice(0, 200), updated_at: now }, { onConflict: 'group_id' });
    const { data: st } = await db.from('chat_state').select('deal_id').eq('group_id', groupId).maybeSingle();
    const dealId = (st as any)?.deal_id as string | null;
    if (dealId) {
      const { data: d } = await db.from('crm_deals').select('id, stage').eq('id', dealId).maybeSingle();
      const stage = (d as any)?.stage as string | undefined;
      if (d && stage !== 'Lost' && stage !== 'Archived' && !LOCKED_STAGES.includes(stage || '')) {
        await db.from('crm_deals').update({ stage: 'Lost', stage_changed_at: now, updated_at: now }).eq('id', dealId);
        await db.from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: null, author_name: 'Pipeline', body: `Pipeline: ${stage} ke Lost (${why}). Tidak akan dihubungi lagi.` }).then(() => undefined, () => undefined);
      } else if (d && LOCKED_STAGES.includes(stage || '')) {
        await db.from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: null, author_name: 'Pipeline', body: `Kakak minta tidak dihubungi lagi (${why}), tapi deal ini sudah di tahap ${stage}. Mohon sales cek manual.` }).then(() => undefined, () => undefined);
      }
    }
  } catch (e) { console.error('mark lost lead failed', e); }
}

/** A person moved the deal to Lost by hand: the same promise, without a message (nobody said anything). */
export async function optOutForLostDeal(ws: string, dealId: string): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: st } = await db.from('chat_state').select('group_id').eq('deal_id', dealId).limit(1).maybeSingle();
    const groupId = (st as any)?.group_id as string | undefined;
    if (!groupId) return;
    const { data: g } = await db.from('wa_groups').select('wa_id, is_group').eq('id', groupId).maybeSingle();
    const waId = String((g as any)?.wa_id || '');
    if (!waId || (g as any)?.is_group || !/^\d{8,16}$/.test(waId)) return;
    const now = new Date().toISOString();
    await db.from('chat_optouts').upsert({ workspace_id: ws, wa_id: waId, reason: 'Moved to Lost by the team' }, { onConflict: 'workspace_id,wa_id' });
    await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'off', reason: 'Lost: moved by the team', updated_at: now }, { onConflict: 'group_id' });
  } catch (e) { console.error('opt out for lost deal failed', e); }
}
