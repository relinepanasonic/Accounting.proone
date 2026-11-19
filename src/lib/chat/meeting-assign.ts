import { createAdminClient } from '@/lib/api/supabase-admin';
import { accessToken, setAttendees } from '@/lib/google/calendar';
import { sendWhatsApp } from '@/lib/wa/send';
import { googleLink, saveVisit, type Meeting } from './meetings';
import { slotLabel } from './meet-rules';
import { cleanTeam } from './sales-team';
import { askText, assignedText, meetCode, readAssignReply, youAreAssignedText, type AssignPick } from './meeting-assign-rules';

/**
 * Who handles a meeting. When a LEAD books the free consultation (the bot or a follow-up), Herlan gets a WhatsApp from the sales number and answers
 * 1 (Herlan), 2 (Velly) or 3 (both). Then, with no sign-in needed from anyone:
 *   - the people chosen are added to the Google event as attendees (their email from the ERP): Google emails them the invitation and it lands in their own calendar;
 *   - the meeting is theirs in the ERP (Meetings and the Today calendar), the chat and the deal are assigned to the first of them;
 *   - the other person is told by WhatsApp.
 * The meeting is already booked when Herlan is asked; until he answers, the ERP owner is the default one.
 */
const ASSIGNER = 'herlan';
const first = (n: string | null | undefined) => String(n || '').trim().split(/\s+/)[0].toLowerCase();
const jkt = (iso: string) => slotLabel(new Date(iso));

async function phoneOfRecipient(ws: string, name: string): Promise<string | null> {
  const { data } = await createAdminClient().from('wa_recipients').select('phone, name').eq('workspace_id', ws).eq('active', true);
  const hit = ((data || []) as Array<{ phone: string; name: string | null }>).find((r) => first(r.name) === name);
  return hit?.phone ?? null;
}

/** Who the people are: id, name, email (from the ERP), WhatsApp number. The sales team in AI Kamus gives the ids; Herlan's number is a report recipient. */
async function peopleOf(ws: string): Promise<Record<'herlan' | 'velly', { id: string; name: string; email: string | null; phone: string | null } | null>> {
  const db = createAdminClient();
  const { data: cfg } = await db.from('wa_bot_config').select('sales_team').eq('workspace_id', ws).maybeSingle();
  const team = cleanTeam((cfg as any)?.sales_team);
  const out: Record<'herlan' | 'velly', any> = { herlan: null, velly: null };
  for (const k of ['herlan', 'velly'] as const) {
    const t = team.find((p) => first(p.name) === k);
    if (!t) continue;
    const { data: prof } = await db.from('profiles').select('email').eq('id', t.id).maybeSingle();
    out[k] = { id: t.id, name: t.name, email: (prof as any)?.email ?? null, phone: t.phone || (k === 'herlan' ? await phoneOfRecipient(ws, 'herlan') : null) };
  }
  return out;
}

const salesToken = () => process.env.FONNTE_TOKEN_SALES;

/** Asks Herlan, by WhatsApp, who handles this meeting. Does nothing (and the default owner stays) when Herlan or the sales number is not set up. */
export async function askAssignment(ws: string, m: Meeting): Promise<boolean> {
  const phone = await phoneOfRecipient(ws, ASSIGNER);
  if (!phone || !salesToken()) return false;
  const r = await sendWhatsApp([phone], askText({ code: meetCode(m.id), lead: m.lead_name || m.chat || 'Calon klien', store: m.store, when: jkt(m.starts_at), meetUrl: m.meet_url }), { token: salesToken() });
  if (!r.ok) return false;
  await createAdminClient().from('chat_meetings').update({ assign_status: 'pending', assign_asked_at: new Date().toISOString() }).eq('id', m.id);
  return true;
}

/** Herlan answered: assign the meeting. */
async function assign(ws: string, m: Meeting, pick: AssignPick): Promise<string> {
  const db = createAdminClient();
  const people = await peopleOf(ws);
  const chosen = (pick === 'both' ? ['herlan', 'velly'] : [pick]).map((k) => people[k as 'herlan' | 'velly']).filter(Boolean) as NonNullable<(typeof people)['herlan']>[];
  if (!chosen.length) return 'Maaf kak, Fefe belum menemukan orang itu di Sales team (AI Kamus). Tambahkan dulu ya.';
  const when = jkt(m.starts_at);
  const lead = m.lead_name || m.chat || 'Calon klien';

  // the ERP: a meeting for each person; the first one is the owner of the meeting, the chat and the deal
  const assignees: Array<{ id: string; name: string; visitId: string | null }> = [];
  for (const p of chosen) {
    const keep = p === chosen[0] ? m.lead_visit_id ?? null : null;
    const visitId = await saveVisit(ws, m, { id: p.id, name: p.name }, keep).catch(() => null);
    if (visitId && p !== chosen[0]) await db.from('lead_visits').update({ mom_status: 'skipped' }).eq('id', visitId);       // only the first person is asked for the notes
    assignees.push({ id: p.id, name: p.name, visitId });
  }
  const main = chosen[0];
  await db.from('chat_meetings').update({ owner_id: main.id, owner_name: main.name, lead_visit_id: assignees[0].visitId, assignees, assign_status: 'done' }).eq('id', m.id);
  if (m.group_id) {
    await db.from('chat_state').upsert({ group_id: m.group_id, workspace_id: ws, assigned_to: main.id, assigned_name: main.name, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
    const { data: st } = await db.from('chat_state').select('deal_id').eq('group_id', m.group_id).maybeSingle();
    if ((st as any)?.deal_id) await db.from('crm_deals').update({ salesman_id: main.id, salesman_name: main.name, updated_at: new Date().toISOString() }).eq('id', (st as any).deal_id);
    await db.from('chat_notes').insert({ workspace_id: ws, group_id: m.group_id, author_id: null, author_name: 'Jadwal', body: `Meeting ${when} dipegang ${chosen.map((c) => c.name).join(' dan ')} (dipilih Herlan).` }).then(() => undefined, () => undefined);
  }

  // Google: an invitation by email, no sign-in for them
  let emailed = false;
  const emails = chosen.map((c) => c.email).filter(Boolean) as string[];
  const link = await googleLink(ws).catch(() => null);
  if (link && m.google_event_id && emails.length) {
    try { await setAttendees(await accessToken(link.refresh_token), link.calendar_id, m.google_event_id, emails); emailed = true; } catch (e) { console.error('google attendees failed', e); }
  }

  // the other person hears it too (Herlan already knows)
  for (const p of chosen) {
    if (first(p.name) === ASSIGNER || !p.phone || !salesToken()) continue;
    await sendWhatsApp([p.phone], youAreAssignedText('Herlan', { lead, store: m.store, when, meetUrl: m.meet_url }), { token: salesToken() }).catch(() => undefined);
  }
  return assignedText(chosen.map((c) => c.name), { lead, when, meetUrl: m.meet_url }, emailed);
}

/**
 * Herlan's WhatsApp answer ("1", "2", "3", a name, optionally with the meeting code). Returns the text to answer with, or null when the message is not an answer
 * to a waiting question (then it is handled as any other message).
 */
export async function handleAssignReply(ws: string, body: string): Promise<string | null> {
  const r = readAssignReply(body);
  if (!r) return null;
  const db = createAdminClient();
  const { data } = await db.from('chat_meetings').select('*, wa_groups(name)').eq('workspace_id', ws).eq('assign_status', 'pending').eq('status', 'booked').order('assign_asked_at', { ascending: true }).limit(20);
  const list = ((data || []) as any[]).map((x) => { const g = Array.isArray(x.wa_groups) ? x.wa_groups[0] : x.wa_groups; const { wa_groups, ...rest } = x; void wa_groups; return { ...rest, chat: g?.name || null } as Meeting; });
  if (!list.length) return null;
  const target = r.code ? list.find((x) => meetCode(x.id) === r.code) : list[0];
  if (!target) return `Fefe tidak menemukan meeting dengan kode ${r.code} yang menunggu jawaban kak.`;
  const text = await assign(ws, target, r.pick);
  const left = list.length - 1;
  return left > 0 ? `${text}\n\nMasih ada ${left} meeting lain yang menunggu: balas lagi pakai angka (untuk yang berikutnya) atau angka + kodenya.` : text;
}
