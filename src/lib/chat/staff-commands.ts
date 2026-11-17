import { createAdminClient } from '@/lib/api/supabase-admin';
import { LOCKED_STAGES, stageLabel } from '@/lib/sales/flow';
import { forget } from './cache';
import { phoneTail } from './channel';
import { archiveJunkLead } from './junk-leads';
import { optOutForLostDeal } from './lost-lead';
import { sendToChat } from './send-any';
import { cleanTeam } from './sales-team';
import { dealCode } from './deal-edit-rules';
import { askBotModel } from '@/lib/wa/bot/model';
import { AI_SYSTEM, codeIn, findMatches, pickMatch, isHiFefe, isTestOff, isTestOn, norm, normalizePhone, parseAiLead, parseLeadCommand, phoneIn, restOf, STAGE_CHOICES, stageFromText, TEMPLATE } from './staff-lead';

/**
 * Team numbers. A salesperson with a WhatsApp number set in AI Kamus > Sales team, and the BOD (Nico, Herlan: the numbers of the report recipients), may write
 * "Hi Fefe" + the template to the sales number: Fefe puts the lead in the ERP pipeline, or changes the pipeline of a lead that is already there, and answers
 * with what it did. A team number is never a lead: its chat is kept out of the inbox tabs, the numbers, the follow-ups and the broadcasts.
 */
export interface StaffPerson { name: string; ownerId: string | null; bod: boolean }

const BOD_NAMES = ['nico', 'herlan', 'lucy'];     // the report numbers allowed to command Fefe: Nico, Herlan and Lucy (Accounting)
const first = (n: string | null | undefined) => String(n || '').trim().split(/\s+/)[0] || '';

/** Who this WhatsApp number is, when it is a team number; else null. */
export async function staffOf(ws: string, waId: string): Promise<StaffPerson | null> {
  if (!/^\d{8,16}$/.test(waId)) return null;
  const t = phoneTail(waId);
  const db = createAdminClient();
  const [{ data: cfg }, { data: rec }] = await Promise.all([
    db.from('wa_bot_config').select('sales_team').eq('workspace_id', ws).maybeSingle(),
    db.from('wa_recipients').select('phone, name').eq('workspace_id', ws).eq('active', true),
  ]);
  const team = cleanTeam((cfg as any)?.sales_team);
  const mine = team.find((p) => p.phone && phoneTail(p.phone) === t);
  if (mine) return { name: first(mine.name) || mine.name, ownerId: mine.id, bod: false };
  const r = ((rec || []) as Array<{ phone: string; name: string | null }>).find((x) => BOD_NAMES.includes(first(x.name).toLowerCase()) && phoneTail(String(x.phone || '')) === t);
  if (!r) return null;
  const asSales = team.find((p) => first(p.name).toLowerCase() === first(r.name).toLowerCase());
  return { name: first(r.name), ownerId: asSales?.id ?? null, bod: true };
}

async function say(ws: string, groupId: string, waId: string, text: string) {
  const res = await sendToChat(groupId, waId, text);
  if (res.ok) await createAdminClient().from('wa_messages').insert({ workspace_id: ws, group_id: groupId, body: text, is_from_me: true, dedupe_key: `staff:${groupId}:${Date.now()}`, sent_at: new Date().toISOString(), source: 'bot', raw: { bot: true, staff: true } }).then(() => undefined, () => undefined);
}

/** The chat of a team number is not a lead: ignored (once), so nothing answers it, counts it or sends it a follow-up or a broadcast. */
async function markTeamChat(ws: string, groupId: string, waId: string) {
  const db = createAdminClient();
  const { data: st } = await db.from('chat_state').select('ignored').eq('group_id', groupId).maybeSingle();
  if ((st as any)?.ignored) return;
  const now = new Date().toISOString();
  const why = 'Nomor tim: bukan lead.';
  await db.from('chat_state').upsert({ group_id: groupId, workspace_id: ws, ignored: true, ignored_reason: why, resolved_at: now, updated_at: now }, { onConflict: 'group_id' });
  await db.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'off', reason: why, updated_at: now }, { onConflict: 'group_id' });
  await archiveJunkLead(ws, groupId, waId);
}

/**
 * A message from a team number. Handled here, never by the lead bot, except in TEST MODE ("Test Fefe" ... "Test off"): then the message goes on to Fefe as if
 * the team member were a lead, and the answer is true. Even then no lead is made, and the chat stays out of the numbers, the follow-ups and the broadcasts. Never throws.
 */
export async function handleStaffMessage(ws: string, groupId: string, waId: string, body: string, who: StaffPerson): Promise<boolean | void> {
  try {
    await markTeamChat(ws, groupId, waId);
    const db0 = createAdminClient();
    const { data: ts } = await db0.from('chat_state').select('test_mode').eq('group_id', groupId).maybeSingle();
    const testing = (ts as any)?.test_mode === true;
    const now0 = new Date().toISOString();
    if (isTestOn(body)) {
      await db0.from('chat_state').upsert({ group_id: groupId, workspace_id: ws, test_mode: true, updated_at: now0 }, { onConflict: 'group_id' });
      await db0.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'bot', reason: null, replies: 0, updated_at: now0 }, { onConflict: 'group_id' });
      return void (await say(ws, groupId, waId, `Mode test aktif kak ${who.name}. Mulai sekarang Fefe menjawab chat ini seperti ke calon pelanggan, tanpa membuat lead. Kirim "Test off" untuk selesai.`));
    }
    if (isTestOff(body)) {
      await db0.from('chat_state').upsert({ group_id: groupId, workspace_id: ws, test_mode: false, updated_at: now0 }, { onConflict: 'group_id' });
      await db0.from('wa_bot_chats').upsert({ group_id: groupId, workspace_id: ws, status: 'off', reason: 'Nomor tim: bukan lead.', updated_at: now0 }, { onConflict: 'group_id' });
      return void (await say(ws, groupId, waId, `Mode test selesai kak ${who.name}. Kirim "Hi Fefe" untuk memasukkan lead, atau "Test Fefe" untuk test lagi.`));
    }
    let f = parseLeadCommand(body);
    let intent: 'create' | 'update' | 'template' = 'template';
    const isCommand = isHiFefe(body) && (!testing || Object.values(f).some(Boolean));      // in test mode a plain "Hi Fefe" is just a greeting
    if (!isCommand) return testing;                               // a team member chatting: in test mode Fefe answers, else nothing
    const say_ = (t: string) => say(ws, groupId, waId, t);
    if (!Object.values(f).some(Boolean)) {
      // not the template: free text ("Hi fefe, masukkan nomor bu Tati brand furniture 0812...") is read by the AI
      const rest = restOf(body);
      const help = `Hi kak ${who.name}, Fefe siap. Tulis saja permintaannya. Untuk lead baru: "Hi Fefe, masukkan Bu Tati, brand furniture, 0812...". Untuk mengubah lead: "Hi Fefe #KODE pindah ke Warm" (kode ada di jawaban Fefe dan di kartu Pipeline), atau pakai nama tokonya. Atau pakai format ini:\n\n${TEMPLATE}\n\nPipeline: ${STAGE_CHOICES}.`;
      if (rest.length < 6) return void (await say_(help));
      let ai: ReturnType<typeof parseAiLead> = null;
      try {
        const out = await askBotModel(AI_SYSTEM, rest);
        ai = parseAiLead(out.text);
        if (!ai) ai = parseAiLead((await askBotModel(AI_SYSTEM, `${rest}\n\nPENTING: balas HANYA dengan satu objek JSON yang valid.`)).text);
      } catch (e) { console.error('staff free text failed', e); }
      if (!ai || ai.action === 'unclear' || !Object.values(ai.fields).some(Boolean)) return void (await say_(`Maaf kak, Fefe belum mengerti permintaannya. Fefe hanya bisa memasukkan lead baru atau mengubah lead (pipeline, data). Jadwal meeting dibuat dari menu Jadwal.\n\n${help}`));
      f = ai.fields;
      intent = ai.action;
      if (!f.phone) f.phone = phoneIn(rest);
    }
    const ask = stageFromText(f.stage);
    if (ask.kind === 'unknown') return void (await say_(`Pipeline "${f.stage}" belum Fefe kenal kak. Pilihannya: ${STAGE_CHOICES}.`));
    if (ask.kind === 'locked') return void (await say_('Tahap Invoice dan Active Client diatur lewat Request Invoice dan pembayaran di ERP, tidak bisa lewat chat kak. Pilihan lewat chat: ' + STAGE_CHOICES + '.'));
    const label = f.brand || f.store || f.pic;
    const code = codeIn(body);
    if (!label && !code) return void (await say_(`Nama Brand, Nama Toko atau Nama PIC wajib diisi ya kak.\n\n${TEMPLATE}`));

    const db = createAdminClient();
    const same = (a: string | null | undefined, b: string) => !!b && !!a && norm(a) === norm(b);
    const { data: clients } = await db.from('clients').select('id, name, store_name, contact_name, billing_address, phone').eq('workspace_id', ws).limit(3000);
    let found: any = null;
    let forcedDealId: string | null = null;
    if (code) {
      // "#A1B2C3": exactly that lead
      const { data: all } = await db.from('crm_deals').select('id, client_id').eq('workspace_id', ws).neq('stage', 'Archived').limit(5000);
      const hit = ((all || []) as any[]).find((d) => dealCode(d.id) === code);
      if (!hit) return void (await say_(`Fefe tidak menemukan lead dengan kode #${code} kak. Cek kodenya di kartu Pipeline atau di jawaban Fefe sebelumnya.`));
      found = ((clients || []) as any[]).find((c) => c.id === hit.client_id) || null;
      forcedDealId = hit.id;
    } else {
      const pick = pickMatch(findMatches(f, (clients || []) as any[], phoneTail));
      if (pick.kind === 'many') {
        const lines: string[] = [];
        const codes: string[] = [];
        for (const m of pick.list) {
          const { data: dd } = await db.from('crm_deals').select('id, stage').eq('client_id', m.client.id).neq('stage', 'Archived').order('created_at', { ascending: false }).limit(1);
          const d0 = (dd || [])[0] as any;
          codes.push(d0 ? dealCode(d0.id) : '');
          lines.push(`- ${m.client.name}${m.client.contact_name ? ` (PIC ${m.client.contact_name})` : ''}${d0 ? `, ${stageLabel(d0.stage)}, kode #${dealCode(d0.id)}` : ''}`);
        }
        return void (await say_(`Ada beberapa lead yang mirip kak, Fefe tidak mau salah ubah:\n${lines.join('\n')}\n\nKirim lagi pakai kodenya, contoh: Hi Fefe #${codes.find(Boolean) || 'KODE'} pindah ke Warm.`));
      }
      if (pick.kind === 'one') found = pick.match.client;
    }
    if (!found && intent === 'update') return void (await say_(`Fefe tidak menemukan lead yang kakak maksud. Tulis nama toko atau nomor HP-nya, atau pakai kode lead (#KODE). Kalau ini lead baru, tulis "masukkan ..." ya.`));
    if (!label) return void (await say_(`Nama Brand, Nama Toko atau Nama PIC wajib diisi ya kak.\n\n${TEMPLATE}`));
    const salesName = who.ownerId ? who.name : null;
    const now = new Date().toISOString();
    const noteLines = [f.category && `Kategori: ${f.category}`, f.note].filter(Boolean).join('\n') || null;

    if (!found) {
      const { data: made, error } = await db.from('clients').insert({
        workspace_id: ws, name: label, store_name: f.store || null, contact_name: f.pic || null, billing_address: f.address || null, phone: normalizePhone(f.phone) || null,
        contact_type: 'client', is_prospect: true, created_by: who.ownerId, sales_name: salesName, lead_source: `Input tim (${who.name})`,
      }).select('id').single();
      if (error || !made) return void (await say_(`Maaf kak, Fefe gagal menyimpan lead ini. Coba lagi sebentar ya.`));
      const stage = ask.kind === 'stage' ? ask.stage : 'Lead';
      const { data: madeDeal, error: dErr } = await db.from('crm_deals').insert({ workspace_id: ws, client_id: (made as any).id, lead_name: label, title: 'Lead dari tim', stage, salesman_id: who.ownerId, salesman_name: salesName, notes: noteLines, pipeline_month: now.slice(0, 7), stage_changed_at: now }).select('id').single();
      if (dErr) { await db.from('clients').delete().eq('id', (made as any).id); return void (await say_('Maaf kak, Fefe gagal menyimpan lead ini. Coba lagi sebentar ya.')); }
      forget(`clients:${ws}`);
      const rows = [f.brand && `Brand: ${f.brand}`, f.store && `Toko: ${f.store}`, f.pic && `PIC: ${f.pic}`, normalizePhone(f.phone) && `No Hp: ${normalizePhone(f.phone)}`, f.address && `Alamat: ${f.address}`, f.category && `Kategori: ${f.category}`].filter(Boolean).join('\n');
      return void (await say_(`Siap kak ${who.name}, lead baru sudah masuk pipeline.\n\n${rows}\nPipeline: ${stageLabel(stage)}\nPemilik: ${salesName || 'belum ada (ambil dari Pipeline)'}\nKode: #${dealCode(String((madeDeal as any)?.id || ''))}\n\nUntuk mengubahnya, kirim: Hi Fefe #${dealCode(String((madeDeal as any)?.id || ''))} + yang diubah (misal: pindah ke Warm).`));
    }

    // the lead is already there: fill what is empty, and change the pipeline when asked
    const patch: Record<string, unknown> = {};
    if (f.store && !found.store_name) patch.store_name = f.store;
    if (f.pic && !found.contact_name) patch.contact_name = f.pic;
    if (f.address && !found.billing_address) patch.billing_address = f.address;
    if (normalizePhone(f.phone) && !found.phone) patch.phone = normalizePhone(f.phone);
    if (Object.keys(patch).length) { await db.from('clients').update({ ...patch, updated_at: now }).eq('id', found.id); forget(`clients:${ws}`); }
    const { data: deals } = forcedDealId
      ? await db.from('crm_deals').select('id, stage, salesman_id, salesman_name, notes').eq('id', forcedDealId).limit(1)
      : await db.from('crm_deals').select('id, stage, salesman_id, salesman_name, notes').eq('client_id', found.id).neq('stage', 'Archived').order('created_at', { ascending: false }).limit(1);
    let deal = ((deals || [])[0] || null) as any;
    if (!deal) {
      const stage = ask.kind === 'stage' ? ask.stage : 'Lead';
      const { data: d } = await db.from('crm_deals').insert({ workspace_id: ws, client_id: found.id, lead_name: found.name, title: 'Lead dari tim', stage, salesman_id: who.ownerId, salesman_name: salesName, notes: noteLines, pipeline_month: now.slice(0, 7), stage_changed_at: now }).select('id, stage').single();
      return void (await say_(`Siap kak ${who.name}, ${found.name} sudah ada di ERP dan Fefe buatkan leadnya. Pipeline: ${stageLabel((d as any)?.stage || stage)}.`));
    }
    if (deal.salesman_id && who.ownerId !== deal.salesman_id && !who.bod) return void (await say_(`Lead ${found.name} dipegang ${deal.salesman_name || 'sales lain'} kak, jadi hanya beliau atau BOD yang bisa mengubahnya.`));
    const dealPatch: Record<string, unknown> = { updated_at: now };
    if (!deal.salesman_id && who.ownerId) { dealPatch.salesman_id = who.ownerId; dealPatch.salesman_name = salesName; }
    if (noteLines && !String(deal.notes || '').includes(noteLines)) dealPatch.notes = [deal.notes, noteLines].filter(Boolean).join('\n');
    let moved = '';
    if (ask.kind === 'stage' && ask.stage !== deal.stage) {
      if (LOCKED_STAGES.includes(deal.stage)) moved = `Pipeline tidak diubah karena lead ini sudah di tahap ${stageLabel(deal.stage)} (diatur lewat invoice di ERP).`;
      else { dealPatch.stage = ask.stage; dealPatch.stage_changed_at = now; moved = `Pipeline: ${stageLabel(deal.stage)} → ${stageLabel(ask.stage)}.`; }
    } else if (ask.kind === 'stage') moved = `Pipeline sudah di ${stageLabel(deal.stage)}.`;
    await db.from('crm_deals').update(dealPatch).eq('id', deal.id);
    if (dealPatch.stage === 'Lost') await optOutForLostDeal(ws, deal.id);
    await say_([`Siap kak ${who.name}, lead ${found.name} sudah Fefe update (bukan lead baru).`, moved, `Kode: #${dealCode(deal.id)}`].filter(Boolean).join('\n'));
  } catch (e) { console.error('staff command failed', e); }
}
