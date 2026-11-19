import { createAdminClient } from '@/lib/api/supabase-admin';
import { accessToken, createEvent } from '@/lib/google/calendar';
import { askBotModel } from '@/lib/wa/bot/model';
import { sendWhatsApp } from '@/lib/wa/send';
import { isForward, LOCKED_STAGES, stageLabel } from '@/lib/sales/flow';
import { forget } from './cache';
import { phoneTail } from './channel';
import { googleLink } from './meetings';
import { cleanTeam } from './sales-team';
import { dealCode } from './deal-edit-rules';
import { clientNoIn, codeIn, findMatches, pickMatch } from './staff-lead';
import { dmyShort, hmDot, inQuietHours, isoJakarta, momAskText, momDue, MOM_SYSTEM, pastText, readMomReply, whenOf, type MeetingAsk } from './pa-rules';

/**
 * Fefe as a personal assistant for the sales team and Herlan.
 *   1. An OFFLINE meeting told to Fefe by WhatsApp ("Hi Fefe, meeting offline dengan Brand X besok jam 14.00 di ...") goes on the team's Google Calendar (the one
 *      that is connected) with the person as a guest, so it lands in their own Google Calendar too; it is put in the ERP's Meetings, and the lead moves to
 *      the pipeline stage "Meeting Offline".
 *   2. An hour after ANY meeting ends (online or offline), Fefe asks the owner for the meeting notes (MoM) by WhatsApp, tidies the answer, and keeps it in the
 *      ERP Meetings, the deal's notes and the chat's team notes. The lead moves to Meeting Done.
 * Everything is sent from the sales number, so the answer comes back to the same chat. Nobody is asked at night.
 */
export interface Who { name: string; ownerId: string | null; bod: boolean }
const first = (n: string | null | undefined) => String(n || '').trim().split(/\s+/)[0].toLowerCase();
const salesToken = () => process.env.FONNTE_TOKEN_SALES;

/** The user ids this person may be: the sales team id, and any member of the company whose first name is theirs. */
export async function userIdsOf(ws: string, who: Who): Promise<string[]> {
  const db = createAdminClient();
  const ids = new Set<string>(who.ownerId ? [who.ownerId] : []);
  const { data: mem } = await db.from('workspace_members').select('user_id').eq('workspace_id', ws).not('user_id', 'is', null);
  const uids = ((mem || []) as Array<{ user_id: string }>).map((m) => m.user_id);
  if (uids.length) {
    const { data: profs } = await db.from('profiles').select('id, full_name').in('id', uids);
    for (const p of (profs || []) as Array<{ id: string; full_name: string | null }>) if (first(p.full_name) === first(who.name)) ids.add(p.id);
  }
  return [...ids];
}

/** The Gmail of a person (from the ERP), to invite them to the event. */
async function emailOf(ws: string, who: Who): Promise<string | null> {
  const ids = await userIdsOf(ws, who);
  if (!ids.length) return null;
  const { data } = await createAdminClient().from('profiles').select('email').in('id', ids).limit(1);
  return ((data || [])[0] as any)?.email ?? null;
}

/** The WhatsApp number of a user: from the sales team in AI Kamus, else the report recipient with the same first name. */
async function phoneOfUser(ws: string, userId: string): Promise<{ name: string; phone: string } | null> {
  const db = createAdminClient();
  const [{ data: cfg }, { data: prof }, { data: rec }] = await Promise.all([
    db.from('wa_bot_config').select('sales_team').eq('workspace_id', ws).maybeSingle(),
    db.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    db.from('wa_recipients').select('phone, name').eq('workspace_id', ws).eq('active', true),
  ]);
  const name = String((prof as any)?.full_name || '').trim();
  const mine = cleanTeam((cfg as any)?.sales_team).find((p) => p.id === userId && p.phone);
  if (mine?.phone) return { name: first(name) ? name.split(/\s+/)[0] : mine.name, phone: mine.phone };
  const r = ((rec || []) as Array<{ phone: string; name: string | null }>).find((x) => first(x.name) === first(name));
  return r && name ? { name: name.split(/\s+/)[0], phone: r.phone } : null;
}

// ---------------------------------------------------------------- 1. an offline meeting
/** The Meeting Offline stage for a deal, never backward and never a deal that is with Accounting. */
async function moveToOffline(dealId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: d } = await db.from('crm_deals').select('id, stage').eq('id', dealId).maybeSingle();
  const stage = (d as any)?.stage as string | undefined;
  if (!stage || LOCKED_STAGES.includes(stage) || !isForward(stage, 'Meeting Offline')) return null;
  const now = new Date().toISOString();
  await db.from('crm_deals').update({ stage: 'Meeting Offline', stage_changed_at: now, updated_at: now }).eq('id', dealId);
  return stage;
}

/**
 * Puts an offline meeting in the calendars and the ERP. `clientId`/`dealId` = the lead it is about (made by the caller when there was none).
 * Returns the answer to the person.
 */
export async function bookOffline(ws: string, who: Who, a: { clientId: string | null; dealId: string | null; clientName: string; ask: MeetingAsk }): Promise<string> {
  const db = createAdminClient();
  const { start, minutes, place } = a.ask;
  const end = new Date(start.getTime() + minutes * 60000);
  const userIds = await userIdsOf(ws, who);
  const ownerId = userIds[0] ?? null;
  const email = await emailOf(ws, who);
  const when = `${dmyShort(start)} jam ${hmDot(start)}`;

  // the ERP's Meetings (and the Today calendar)
  let visitId: string | null = null;
  if (ownerId) {
    const { data: v, error } = await db.from('lead_visits').insert({
      workspace_id: ws, deal_id: a.dealId, client_id: a.clientId, client_name: a.clientName.slice(0, 120), salesman_id: ownerId, salesman_name: who.name,
      agenda: ['Meeting offline (dibuat lewat Fefe)', place ? `Lokasi: ${place}` : ''].filter(Boolean).join('. '),
      visit_at: start.toISOString(), ends_at: end.toISOString(), location: place || null, kind: 'offline',
    }).select('id').single();
    if (error) console.error('offline visit failed', error.message); else visitId = (v as any)?.id ?? null;
  }

  // the team's Google Calendar (the connected one), with the person as a guest: it lands in their own calendar too, no sign-in
  let calendar = '';
  const link = await googleLink(ws).catch(() => null);
  if (!link) calendar = 'Google Calendar belum terhubung (cek di Jadwal), jadi belum masuk kalender.';
  else {
    try {
      const ev = await createEvent(await accessToken(link.refresh_token), link.calendar_id, {
        title: `Meeting offline: ${a.clientName}`, description: [`Dibuat lewat Fefe oleh ${who.name}.`, place ? `Lokasi: ${place}` : ''].filter(Boolean).join('\n'),
        location: place || null, start, end, attendees: email ? [email] : [], requestId: visitId || `pa-${start.getTime()}-${first(who.name)}`,
      });
      if (visitId) await db.from('lead_visits').update({ google_event_id: ev.id }).eq('id', visitId);
      calendar = email ? 'Masuk ke kalender tim, dan undangannya dikirim ke Google Calendar kakak.' : 'Masuk ke kalender tim (email kakak belum ada di ERP, jadi undangan pribadi tidak terkirim).';
    } catch (e: any) { console.error('offline google event failed', e); calendar = `Google Calendar menolak: ${String(e?.message || e).slice(0, 100)}.`; }
  }

  // the lead: the pipeline stage and a note for the team
  let stageLine = '';
  if (a.dealId) {
    const from = await moveToOffline(a.dealId);
    if (from) stageLine = `Pipeline: ${stageLabel(from)} → Meeting Offline.`;
    const { data: st } = await db.from('chat_state').select('group_id').eq('deal_id', a.dealId).limit(1).maybeSingle();
    const groupId = (st as any)?.group_id as string | undefined;
    if (groupId) await db.from('chat_notes').insert({ workspace_id: ws, group_id: groupId, author_id: null, author_name: 'Fefe (PA)', body: `Meeting offline ${when}${place ? ` di ${place}` : ''}, dicatat ${who.name}.` }).then(() => undefined, () => undefined);
  }
  return [
    `Siap kak ${who.name}, meeting offline dengan ${a.clientName} sudah Fefe catat.`,
    `   tanggal : ${when} (${minutes} menit)`,
    place ? `   lokasi : ${place}` : '',
    calendar, stageLine,
    visitId ? 'Fefe akan tanya notes meetingnya 1 jam setelah selesai.' : 'Catatan: akun kakak belum terhubung ke ERP, jadi Fefe belum bisa menanyakan notes setelahnya.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- the meeting asked in words
export const MEETING_AI = (now: Date) => `Kamu membaca pesan WhatsApp dari anggota tim sales kepada asisten Fefe. Tentukan apakah pesan itu meminta MENCATAT sebuah MEETING (pertemuan, ketemu, kunjungan) di kalender. Sekarang: ${dmyShort(now)} jam ${hmDot(now)} WIB (hari ${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(now.getTime() + 7 * 3600000).getUTCDay()]}).
Balas HANYA dengan satu objek JSON, tanpa teks lain:
{"meeting":true,"dengan":"","mulai":"YYYY-MM-DDTHH:mm","menit":60,"lokasi":""}
- "meeting": true hanya kalau pesan jelas meminta mencatat atau menjadwalkan meeting dengan seseorang atau sebuah toko. Selain itu false.
- "dengan": nama brand, toko atau orang yang ditemui, persis seperti ditulis.
- "mulai": tanggal dan jam mulai dalam waktu Jakarta (WIB). Hitung dari hari ini kalau ditulis "besok", "lusa", nama hari, atau "minggu depan". Kosongkan "" kalau tanggal atau jamnya tidak disebut. Jangan menebak jam.
- "menit": lama meeting kalau disebut, kalau tidak 60.
- "lokasi": tempat kalau disebut, kalau tidak "".`;

export function parseMeetingAi(text: string): { meeting: boolean; withWhom: string; start: Date | null; minutes: number; place: string } | null {
  const m = /\{[\s\S]*\}/.exec(String(text ?? ''));
  if (!m) return null;
  let j: any;
  try { j = JSON.parse(m[0]); } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  const minutes = Math.round(Number(j.menit));
  return { meeting: j.meeting === true, withWhom: String(j.dengan ?? '').replace(/\s+/g, ' ').trim().slice(0, 120), start: isoJakarta(j.mulai), minutes: Number.isFinite(minutes) && minutes >= 15 && minutes <= 480 ? minutes : 60, place: String(j.lokasi ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) };
}

/** The labelled template: "Meeting Offline / Dengan: / Tanggal: / Jam: / Lokasi: / Durasi:". Null when the message is not that template. */
export function parseMeetingTemplate(body: string, now: Date): { complete: boolean; withWhom: string; start: Date | null; minutes: number; place: string; dateText: string; timeText: string } | null {
  const lines = String(body ?? '').replace(/\r\n/g, '\n').split('\n');
  if (!lines.some((l) => /^\s*meeting\s+offline\s*$/i.test(l))) return null;
  const get = (...labels: string[]) => { for (const l of lines) { const m = /^\s*([A-Za-z ]{2,20}?)\s*[:=]\s*(.*)$/.exec(l); if (m && labels.includes(m[1].toLowerCase().replace(/\s+/g, ' ').trim())) return m[2].trim(); } return ''; };
  const dateText = get('tanggal', 'tgl', 'date'); const timeText = get('jam', 'waktu', 'time', 'pukul');
  const dur = Number((/(\d{2,3})/.exec(get('durasi', 'lama')) || [])[1]);
  return { complete: true, withWhom: get('dengan', 'bertemu dengan', 'dengan siapa', 'klien', 'brand').slice(0, 120), start: whenOf(dateText, timeText, now), minutes: dur >= 15 && dur <= 480 ? dur : 60, place: get('lokasi', 'tempat', 'alamat', 'di').slice(0, 200), dateText, timeText };
}

/** Does the message look like a request to note a meeting (before the AI is asked)? */
export const looksLikeMeeting = (text: string) => /\b(meeting|ketemu|ketemuan|bertemu|kunjungan|visit|janji temu|jadwal(kan)?|bikin(kan)? (jadwal|meeting)|catat(kan)? meeting)\b/i.test(text) && /(\d{1,2}\s*[.:]\s*\d{2}|\bjam\b|\b(besok|lusa|hari ini|senin|selasa|rabu|kamis|jumat|sabtu|minggu)\b|\d{1,2}[\s/.-]+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i.test(text);

/**
 * "Hi Fefe ... meeting ...": noted in the calendars, and the lead found (or made). Returns the answer, or null when the message is not about a meeting
 * (then it is handled as a lead command).
 */
export async function handleMeetingCommand(ws: string, who: Who, body: string, now = new Date()): Promise<string | null> {
  const tpl = parseMeetingTemplate(body, now);
  let ask: { withWhom: string; start: Date | null; minutes: number; place: string } | null = null;
  if (tpl) ask = tpl;
  else if (looksLikeMeeting(body)) {
    try {
      const rest = body.replace(/^\s*(hi|hai|halo|hello|hey)\s+fefe\b[\s,.:!-]*/i, '').trim();
      const out = await askBotModel(MEETING_AI(now), rest);
      const p = parseMeetingAi(out.text);
      if (p?.meeting) ask = p;
    } catch (e) { console.error('meeting ai failed', e); }
  }
  if (!ask) return null;
  if (!ask.withWhom) return `Dengan siapa meetingnya kak? Tulis nama brand atau tokonya ya.\n\nContoh: Hi Fefe, meeting offline dengan Brand X besok jam 14.00 di Kopi Kenangan.`;
  if (!ask.start) return `Fefe butuh tanggal dan jam meetingnya kak.\n\nContoh: Hi Fefe, meeting offline dengan ${ask.withWhom} tanggal 19 Nov 26 jam 14.00 di (lokasi).`;
  if (ask.start.getTime() < now.getTime() - 15 * 60000) return pastText;

  // the lead: by ID, code, phone, store, brand or person; made when there is none
  const db = createAdminClient();
  const { data: clients } = await db.from('clients').select('id, client_no, name, store_name, contact_name, phone').eq('workspace_id', ws).limit(3000);
  const list = (clients || []) as any[];
  let found: any = null; let dealId: string | null = null;
  const code = codeIn(body); const cno = clientNoIn(body);
  if (code) {
    const { data: all } = await db.from('crm_deals').select('id, client_id').eq('workspace_id', ws).neq('stage', 'Archived').limit(5000);
    const hit = ((all || []) as any[]).find((d) => dealCode(d.id) === code);
    if (!hit) return `Fefe tidak menemukan lead dengan kode #${code} kak.`;
    found = list.find((c) => c.id === hit.client_id) || null; dealId = hit.id;
  } else if (cno) {
    found = list.find((c) => Number(c.client_no) === cno) || null;
    if (!found) return `Fefe tidak menemukan klien dengan ID ${cno} kak.`;
  } else {
    const fields = { brand: ask.withWhom, store: '', pic: ask.withWhom, address: '', category: '', stage: '', phone: '', note: '' };
    const pick = pickMatch(findMatches(fields, list, phoneTail));
    if (pick.kind === 'many') {
      const lines: string[] = [];
      for (const m of pick.list) lines.push(`- ${m.client.name}${(m.client as any).client_no ? ` (ID ${(m.client as any).client_no})` : ''}`);
      return `Ada beberapa yang mirip kak:\n${lines.join('\n')}\n\nKirim lagi pakai ID-nya, contoh: Hi Fefe meeting offline ID ${(pick.list[0].client as any).client_no ?? '1001'} besok jam 14.00.`;
    }
    if (pick.kind === 'one') found = pick.match.client;
  }
  const ownerIds = await userIdsOf(ws, who);
  const salesName = who.ownerId ? who.name : null;
  const nowIso = new Date().toISOString();
  if (!found) {
    const { data: made, error } = await db.from('clients').insert({ workspace_id: ws, name: ask.withWhom, contact_type: 'client', is_prospect: true, created_by: ownerIds[0] ?? null, sales_name: salesName, lead_source: `Input tim (${who.name})` }).select('id, client_no, name').single();
    if (error || !made) return 'Maaf kak, Fefe gagal menyimpan leadnya. Coba lagi sebentar ya.';
    const { data: d } = await db.from('crm_deals').insert({ workspace_id: ws, client_id: (made as any).id, lead_name: ask.withWhom, title: 'Lead dari tim', stage: 'Lead', salesman_id: who.ownerId ?? ownerIds[0] ?? null, salesman_name: salesName || who.name, pipeline_month: nowIso.slice(0, 7), stage_changed_at: nowIso }).select('id').single();
    forget(`clients:${ws}`);
    found = made; dealId = (d as any)?.id ?? null;
  } else if (!dealId) {
    const { data: ds } = await db.from('crm_deals').select('id').eq('client_id', found.id).neq('stage', 'Archived').order('created_at', { ascending: false }).limit(1);
    dealId = ((ds || [])[0] as any)?.id ?? null;
    if (!dealId) {
      const { data: d } = await db.from('crm_deals').insert({ workspace_id: ws, client_id: found.id, lead_name: found.name, title: 'Lead dari tim', stage: 'Lead', salesman_id: who.ownerId ?? ownerIds[0] ?? null, salesman_name: salesName || who.name, pipeline_month: nowIso.slice(0, 7), stage_changed_at: nowIso }).select('id').single();
      dealId = (d as any)?.id ?? null;
    }
  }
  return bookOffline(ws, who, { clientId: found.id, dealId, clientName: String(found.name || ask.withWhom), ask: { withWhom: ask.withWhom, start: ask.start, minutes: ask.minutes, place: ask.place } });
}

// ---------------------------------------------------------------- 2. the meeting notes (MoM)
/**
 * The clock: an hour after a meeting ends (online or offline), the owner is asked for the notes by WhatsApp. Once per meeting (claimed first), once more
 * three hours later when the answer was "nanti". Not at night. Returns how many were asked. Never throws.
 */
export async function runMomRequests(now = new Date()): Promise<number> {
  try {
    if (inQuietHours(now) || !salesToken()) return 0;
    const db = createAdminClient();
    const since = new Date(now.getTime() - 36 * 3600000).toISOString();
    const upto = new Date(now.getTime() - 55 * 60000).toISOString();
    const { data } = await db.from('lead_visits').select('id, workspace_id, client_name, salesman_id, visit_at, ends_at, mom_status, mom_asked_at').gte('visit_at', since).lte('visit_at', upto).in('mom_status', ['pending', 'later']).limit(50);
    let asked = 0;
    for (const v of (data || []) as any[]) {
      const status = String(v.mom_status);
      if (status === 'later' && (!v.mom_asked_at || now.getTime() - new Date(v.mom_asked_at).getTime() < 3 * 3600000)) continue;
      if (status === 'pending' && !momDue(new Date(v.visit_at), v.ends_at ? new Date(v.ends_at) : null, now)) continue;
      const to = await phoneOfUser(v.workspace_id, v.salesman_id);
      const nextStatus = status === 'later' ? 'asked2' : 'asked';
      // claim it first, so two clock calls never ask twice
      const { data: claimed } = await db.from('lead_visits').update({ mom_status: nextStatus, mom_asked_at: now.toISOString() }).eq('id', v.id).eq('mom_status', status).select('id');
      if (!claimed?.length) continue;
      if (!to) { await db.from('lead_visits').update({ mom_status: 'skipped' }).eq('id', v.id); continue; }
      const r = await sendWhatsApp([to.phone], momAskText(to.name, { start: new Date(v.visit_at), with: String(v.client_name || 'Klien') }), { token: salesToken() });
      if (r.ok) asked++; else await db.from('lead_visits').update({ mom_status: status, mom_asked_at: null }).eq('id', v.id);
    }
    return asked;
  } catch (e) { console.error('mom requests failed', e); return 0; }
}

async function structureMom(raw: string, ctx: { client: string; when: string }): Promise<string> {
  try {
    const out = await askBotModel(MOM_SYSTEM, `Meeting dengan ${ctx.client}, ${ctx.when}.\nCatatan dari sales:\n${raw}`, { json: false });
    const t = out.text.replace(/\*+/g, '').trim();
    if (t.length >= 20) return t.slice(0, 1200);
  } catch (e) { console.error('mom structure failed', e); }
  return `Ringkasan: ${raw.slice(0, 600)}`;
}

/**
 * A team member's answer to "Notes meetingnya apa ya?". Returns the text to answer with, or null when nothing was asked of this person (the message is then
 * handled as any other).
 */
export async function handleMomReply(ws: string, who: Who, body: string): Promise<string | null> {
  const r = readMomReply(body);
  if (!r) return null;
  const db = createAdminClient();
  const ids = await userIdsOf(ws, who);
  if (!ids.length) return null;
  const { data } = await db.from('lead_visits').select('id, client_name, visit_at, agenda, deal_id, client_id, mom_status').eq('workspace_id', ws).in('salesman_id', ids).in('mom_status', ['asked', 'asked2']).order('mom_asked_at', { ascending: true }).limit(10);
  const list = (data || []) as any[];
  const v = list[0];
  if (!v) return null;
  const left = list.length - 1;
  const more = left > 0 ? `\n\nMasih ada ${left} meeting lain yang menunggu notesnya.` : '';
  const when = `${dmyShort(new Date(v.visit_at))} jam ${hmDot(new Date(v.visit_at))}`;
  const now = new Date().toISOString();

  if (r.kind === 'skip') { await db.from('lead_visits').update({ mom_status: 'skipped' }).eq('id', v.id); return `Oke kak, meeting ${v.client_name} (${when}) Fefe lewati.${more}`; }
  if (r.kind === 'later') {
    if (v.mom_status === 'asked2') { await db.from('lead_visits').update({ mom_status: 'skipped' }).eq('id', v.id); return `Oke kak, Fefe tidak tanya lagi untuk meeting ${v.client_name}.${more}`; }
    await db.from('lead_visits').update({ mom_status: 'later', mom_asked_at: now }).eq('id', v.id);
    return `Siap kak, Fefe tanya lagi 3 jam lagi ya.${more}`;
  }

  const summary = await structureMom(r.notes, { client: v.client_name, when });
  await db.from('lead_visits').update({ mom_status: 'done', mom_text: r.notes, mom_summary: summary, mom_at: now, agenda: `${String(v.agenda || '').slice(0, 600)}\n\nMoM: ${summary}`.slice(0, 2400) }).eq('id', v.id);
  let line = '';
  if (v.deal_id) {
    const { data: d } = await db.from('crm_deals').select('id, stage, notes').eq('id', v.deal_id).maybeSingle();
    if (d) {
      const patch: Record<string, unknown> = { notes: [String((d as any).notes || ''), `MoM ${dmyShort(new Date(v.visit_at))}: ${summary}`].filter(Boolean).join('\n').slice(0, 4000), updated_at: now };
      const stage = String((d as any).stage);
      if (!LOCKED_STAGES.includes(stage) && isForward(stage, 'Meeting Done')) { patch.stage = 'Meeting Done'; patch.stage_changed_at = now; line = `Pipeline: ${stageLabel(stage)} → Meeting Done.`; }
      await db.from('crm_deals').update(patch).eq('id', v.deal_id);
    }
    const { data: st } = await db.from('chat_state').select('group_id').eq('deal_id', v.deal_id).limit(1).maybeSingle();
    if ((st as any)?.group_id) await db.from('chat_notes').insert({ workspace_id: ws, group_id: (st as any).group_id, author_id: null, author_name: 'MoM', body: `Meeting ${when}, dicatat ${who.name}:\n${summary}` }).then(() => undefined, () => undefined);
  }
  return [`Siap kak ${who.name}, notes meeting ${v.client_name} (${when}) sudah Fefe catat:`, '', summary, '', line, 'Tersimpan di ERP (Meetings), catatan lead, dan chat-nya.'].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n') + more;
}

