import { createAdminClient } from '@/lib/api/supabase-admin';
import { availableSlots, slotLabel, type Meeting } from './meetings';
import { noShowText, offerSlots, thanksText } from './meet-rules';
import { createLeadFromChat } from './crm-data';
import { phoneTail } from './channel';
import { sendToChat } from './send-any';

/**
 * After the consultation, when the team marks it (Jadwal or the chat panel):
 *  - Done: the lead is thanked (and told who sends the next step), and the lead in the ERP moves to Negotiation (made first when there is none).
 *  - Did not come: the lead gets three other free times; answering with a number books it (the same as a follow-up nudge, see nudges.ts).
 * Each message can be switched off in Jadwal. Runs once, only when a booked meeting becomes Done or Did not come. Never throws.
 */
export interface AfterSettings { thanks: boolean; noShow: boolean }

export async function afterSettings(ws: string): Promise<AfterSettings> {
  const { data } = await createAdminClient().from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle();
  const r: any = data || {};
  return { thanks: r.after_thanks !== false, noShow: r.after_no_show !== false };
}

export async function saveAfterSettings(ws: string, p: { thanks?: unknown; noShow?: unknown }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const row: Record<string, unknown> = { workspace_id: ws, updated_at: new Date().toISOString() };
  if (typeof p.thanks === 'boolean') row.after_thanks = p.thanks;
  if (typeof p.noShow === 'boolean') row.after_no_show = p.noShow;
  const { error } = await createAdminClient().from('wa_bot_config').upsert(row, { onConflict: 'workspace_id' });
  return error ? { ok: false, status: 500, error: /column/.test(error.message) ? 'The after-meeting settings are not in the database yet: run the SQL first.' : error.message } : { ok: true };
}

export interface AfterResult { message: 'sent' | 'off' | 'failed' | 'none'; stage?: string | null; detail: string }

async function chatTarget(ws: string, groupId: string): Promise<{ waId: string; name: string | null } | null> {
  const { data } = await createAdminClient().from('wa_groups').select('wa_id, name').eq('id', groupId).eq('workspace_id', ws).maybeSingle();
  return data ? { waId: String((data as any).wa_id), name: (data as any).name ?? null } : null;
}

async function say(ws: string, groupId: string, waId: string, text: string, key: string): Promise<boolean> {
  const r = await sendToChat(groupId, waId, text);
  if (r.ok) await createAdminClient().from('wa_messages').insert({ workspace_id: ws, group_id: groupId, body: text, is_from_me: true, dedupe_key: `${key}:${Date.now()}`, sent_at: new Date().toISOString(), source: 'bot', raw: { bot: true } }).then(() => undefined, () => undefined);
  return r.ok;
}

async function note(ws: string, groupId: string, body: string) {
  await createAdminClient().from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: null, author_name: 'Jadwal', body }).then(() => undefined, () => undefined);
}

/**
 * The lead in the ERP after a consultation that happened: the chat's open deal (by the client with this number) moves to Negotiation; Invoice and
 * Deal are never moved back. Without a deal, a lead is made for the salesperson of the meeting and put in Negotiation. Returns the stage, or null.
 */
async function moveLead(ws: string, m: Meeting, chatName: string | null, waId: string): Promise<string | null> {
  const db = createAdminClient();
  const t = phoneTail(waId);
  let dealId: string | null = null; let stage: string | null = null; let clientId: string | null = null;
  if (t.length >= 8) {
    const { data: clients } = await db.from('clients').select('id, phone').eq('workspace_id', ws).not('phone', 'is', null).limit(3000);
    const mine = ((clients || []) as Array<{ id: string; phone: string }>).filter((c) => phoneTail(c.phone) === t).map((c) => c.id);
    if (mine.length) {
      const { data: deals } = await db.from('crm_deals').select('id, stage, client_id').in('client_id', mine).neq('stage', 'Cold Case').order('created_at', { ascending: false }).limit(1);
      const d = (deals || [])[0] as any;
      if (d) { dealId = d.id; stage = d.stage; clientId = d.client_id; }
    }
  }
  if (stage === 'Invoice' || stage === 'Deal' || stage === 'Negotiation') return stage;
  if (!dealId) {
    if (!m.owner_id || !m.group_id) return null;
    const made = await createLeadFromChat(ws, m.group_id, { name: m.lead_name || chatName || undefined, title: 'Konsultasi gratis (dari chat)', store: m.store || undefined, salesmanId: m.owner_id }, { userId: m.owner_id, name: m.owner_name || 'Sales', role: 'founder' });
    if (!made.ok) { console.error('after-meeting lead failed', made.error); return null; }
    dealId = made.dealId; clientId = made.clientId;
  }
  const now = new Date().toISOString();
  await db.from('crm_deals').update({ stage: 'Negotiation', stage_changed_at: now, updated_at: now }).eq('id', dealId);
  if (m.lead_visit_id) await db.from('lead_visits').update({ deal_id: dealId, client_id: clientId }).eq('id', m.lead_visit_id).then(() => undefined, () => undefined);
  return 'Negotiation';
}

/** Runs the after-meeting step for a meeting that just became Done or Did not come. */
export async function afterMeeting(ws: string, meetingId: string, status: 'done' | 'no_show'): Promise<AfterResult> {
  try {
    const db = createAdminClient();
    const { data } = await db.from('chat_meetings').select('*').eq('id', meetingId).eq('workspace_id', ws).maybeSingle();
    const m = data as Meeting | null;
    if (!m?.group_id) return { message: 'none', detail: 'Booked by hand, without a chat: nothing to send.' };
    const chat = await chatTarget(ws, m.group_id);
    if (!chat) return { message: 'none', detail: 'The chat no longer exists.' };
    const s = await afterSettings(ws);
    const start = new Date(m.starts_at);

    if (status === 'done') {
      const stage = await moveLead(ws, m, chat.name, chat.waId).catch((e) => { console.error('after-meeting stage failed', e); return null; });
      if (stage) await note(ws, m.group_id, `Konsultasi ${slotLabel(start)} selesai. Lead di ERP: ${stage}.`);
      if (!s.thanks) return { message: 'off', stage, detail: `Marked done.${stage ? ` The ERP lead is in ${stage}.` : ''}` };
      const ok = await say(ws, m.group_id, chat.waId, thanksText(m.lead_name || chat.name || '', m.owner_name ?? null), `thanks:${m.id}`);
      return { message: ok ? 'sent' : 'failed', stage, detail: `${ok ? 'The lead got a thank-you.' : 'The thank-you could not be sent.'}${stage ? ` The ERP lead is in ${stage}.` : ''}` };
    }

    await note(ws, m.group_id, `Lead tidak hadir di konsultasi ${slotLabel(start)}.`);
    if (!s.noShow) return { message: 'off', detail: 'Marked as did not come.' };
    const three = offerSlots(await availableSlots(ws, true), 3);
    if (!three.length) return { message: 'none', detail: 'Marked as did not come. No free times to offer: contact the lead yourself.' };
    const now = new Date().toISOString();
    // the numbered times are kept like a nudge's, so a number in reply books it (handleNudgeReply)
    await db.from('chat_nudges').upsert({ group_id: m.group_id, workspace_id: ws, offer: three.map((d) => d.toISOString()), offer_at: now }, { onConflict: 'group_id' });
    const ok = await say(ws, m.group_id, chat.waId, noShowText(start, m.lead_name || chat.name || '', three), `noshow:${m.id}`);
    return { message: ok ? 'sent' : 'failed', detail: ok ? 'The lead got 3 new times to book again.' : 'The new times could not be sent.' };
  } catch (e: any) {
    console.error('after meeting failed', e);
    return { message: 'failed', detail: String(e?.message || e).slice(0, 160) };
  }
}
