import crypto from 'crypto';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { askBotModel } from '@/lib/wa/bot/model';
import { sendWhatsApp } from '@/lib/wa/send';
import { cleanGroupReply, GROUP_SYSTEM, mayAnswerNow, parseGroupAnswer, worthAnswering, type GroupHistory } from './group-rules';
import { MARKETPLACE_KNOWLEDGE } from './group-knowledge';
import { staffOf } from './staff-commands';

/**
 * Fefe as a marketplace consultant in WhatsApp groups. The sales number may be a member of random seller groups; a group message is NEVER stored, and nobody
 * in it becomes a lead or is contacted. Fefe answers only in groups the team switched on, only a real marketplace question, a few times a day, with a pause.
 * The only thing kept is a log line per answer (the question, the answer) and a one-way hash of the asker for the "not the same person again" pause.
 */
type Device = { id: string; workspace_id: string; phone: string };
type Msg = { chatId: string; groupName: string | null; senderPhone: string | null; body: string | null; isFromMe: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hashOf = (phone: string | null) => (phone ? crypto.createHash('sha256').update(`${process.env.CRON_SECRET || 'fefe'}:${phone}`).digest('hex').slice(0, 16) : '');
const jakartaMidnight = (now: Date) => { const j = new Date(now.getTime() + 7 * 3600000); return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()) - 7 * 3600000); };

export async function handleSalesGroupMessage(device: Device, m: Msg, now = new Date()): Promise<string> {
  try {
    const db = createAdminClient();
    // the group is listed (so the team can switch Fefe on there), but its messages are not kept
    const { data: g } = await db.from('wa_groups').upsert({ workspace_id: device.workspace_id, device_id: device.id, wa_id: m.chatId, is_group: true, last_message_at: now.toISOString(), ...(m.groupName ? { name: m.groupName } : {}) }, { onConflict: 'workspace_id,wa_id' }).select('id, fefe_active').single();
    if (!g || (g as any).fefe_active !== true) return 'group-off';
    if (m.isFromMe) return 'own-message';
    const text = String(m.body || '').trim();
    if (!worthAnswering(text)) return 'not-a-question';
    const { data: cfg } = await db.from('wa_bot_config').select('enabled').eq('workspace_id', device.workspace_id).maybeSingle();
    if ((cfg as any)?.enabled === false) return 'bot-off';
    if (m.senderPhone && (await staffOf(device.workspace_id, m.senderPhone).catch(() => null))) return 'team-member';

    const groupId = (g as any).id as string;
    const who = hashOf(m.senderPhone);
    const { data: recent } = await db.from('fefe_group_answers').select('created_at, sender_hash, ok, detail').eq('group_id', groupId).gte('created_at', new Date(now.getTime() - 24 * 3600000).toISOString()).order('created_at', { ascending: false }).limit(50);
    const answered = ((recent || []) as any[]).filter((r) => r.ok === true || r.detail === 'pending');
    const midnight = jakartaMidnight(now).getTime();
    const hist: GroupHistory = {
      lastAnswerAt: answered[0]?.created_at ?? null,
      answersToday: answered.filter((r) => new Date(r.created_at).getTime() >= midnight).length,
      personLastAt: who ? answered.find((r) => r.sender_hash === who)?.created_at ?? null : null,
    };
    const may = mayAnswerNow(hist, now);
    if (!may.ok) return may.why;

    // claim the slot first, so two messages at once never get two answers
    const { data: claim } = await db.from('fefe_group_answers').insert({ workspace_id: device.workspace_id, group_id: groupId, sender_hash: who || null, question: text.slice(0, 600), ok: false, detail: 'pending' }).select('id').single();
    const claimId = (claim as any)?.id as string | undefined;
    const drop = async () => { if (claimId) await db.from('fefe_group_answers').delete().eq('id', claimId); };

    let parsed = null as ReturnType<typeof parseGroupAnswer>;
    try {
      const out = await askBotModel(GROUP_SYSTEM(MARKETPLACE_KNOWLEDGE), text);
      parsed = parseGroupAnswer(out.text);
      if (!parsed) parsed = parseGroupAnswer((await askBotModel(GROUP_SYSTEM(MARKETPLACE_KNOWLEDGE), `${text}\n\nPENTING: balas HANYA dengan satu objek JSON yang valid.`)).text);
    } catch (e) { console.error('group answer failed', e); }
    if (!parsed || !parsed.answer) { await drop(); return 'model-skipped'; }
    const reply = cleanGroupReply(parsed.reply, { invite: parsed.invite, salesPhone: device.phone });
    if (!reply) { await drop(); return 'empty-reply'; }

    await sleep(6000 + Math.floor(Math.random() * 14000));                // a person takes a moment
    if (!process.env.FONNTE_TOKEN_SALES) { await drop(); return 'no-token'; }
    const res = await sendWhatsApp([`${m.chatId}@g.us`], reply, { token: process.env.FONNTE_TOKEN_SALES });
    if (claimId) await db.from('fefe_group_answers').update({ reply, ok: res.ok, detail: res.ok ? 'sent' : res.detail.slice(0, 200) }).eq('id', claimId);
    return res.ok ? 'answered' : 'send-failed';
  } catch (e) { console.error('group consultant failed', e); return 'error'; }
}

// ---------------------------------------------------------------- the team's switch (AI Kamus)
export async function listSalesGroups(ws: string) {
  const db = createAdminClient();
  const { data: devs } = await db.from('wa_devices').select('id').eq('workspace_id', ws).eq('role', 'sales');
  const ids = ((devs || []) as Array<{ id: string }>).map((d) => d.id);
  if (!ids.length) return { groups: [] };
  const { data: gs } = await db.from('wa_groups').select('id, name, wa_id, fefe_active, last_message_at').eq('workspace_id', ws).eq('is_group', true).in('device_id', ids).order('last_message_at', { ascending: false }).limit(200);
  const list = (gs || []) as any[];
  const since = jakartaMidnight(new Date()).toISOString();
  const { data: ans } = list.length ? await db.from('fefe_group_answers').select('group_id, ok, created_at').in('group_id', list.map((x) => x.id)).eq('ok', true).limit(5000) : { data: [] as any[] };
  const today = new Map<string, number>(); const total = new Map<string, number>();
  for (const a of (ans || []) as any[]) { total.set(a.group_id, (total.get(a.group_id) ?? 0) + 1); if (a.created_at >= since) today.set(a.group_id, (today.get(a.group_id) ?? 0) + 1); }
  return { groups: list.map((g) => ({ id: g.id as string, name: String(g.name || `Group ···${String(g.wa_id).slice(-6)}`), active: g.fefe_active === true, lastAt: g.last_message_at as string | null, today: today.get(g.id) ?? 0, total: total.get(g.id) ?? 0 })) };
}

export async function setGroupActive(ws: string, id: string, active: boolean): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const { data: g } = await db.from('wa_groups').select('id, is_group').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!g || !(g as any).is_group) return { ok: false, status: 404, error: 'Group not found.' };
  const { error } = await db.from('wa_groups').update({ fefe_active: active }).eq('id', id);
  return error ? { ok: false, status: 500, error: error.message } : { ok: true };
}
