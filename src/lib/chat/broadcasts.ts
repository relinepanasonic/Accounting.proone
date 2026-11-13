import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendWhatsApp } from '@/lib/wa/send';
import { BC_DEFAULTS, composeMessage, daysNeeded, jakartaMidnight, MAX_FAILS_IN_ROW, nextGapMs, nextOpening, splitVariants, STOP_REPLY, type BcSettings } from './broadcast-rules';
import { validTime } from './meet-rules';
import { sendToChat } from './send-any';

/**
 * WhatsApp broadcasts (server side). One push queues every past lead of the sales number; the clock then sends ONE message at a time, with a random
 * pause, only inside the time window, and never more than the daily maximum. Instagram and Messenger are never included (Meta's 24-hour rule).
 * People who answer STOP are never sent another. Rules in broadcast-rules.ts (tested).
 */
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

// ---------------------------------------------------------------- settings
export async function bcSettings(ws: string): Promise<BcSettings> {
  const { data } = await createAdminClient().from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle();
  const r: any = data || {};
  return {
    dailyMax: Number(r.bc_daily_max) || BC_DEFAULTS.dailyMax, from: validTime(r.bc_from) ? r.bc_from : BC_DEFAULTS.from, to: validTime(r.bc_to) ? r.bc_to : BC_DEFAULTS.to,
    gapMin: Number(r.bc_gap_min) || BC_DEFAULTS.gapMin, gapMax: Number(r.bc_gap_max) || BC_DEFAULTS.gapMax,
  };
}

export async function saveBcSettings(ws: string, p: Partial<BcSettings>): Promise<{ ok: true } | Fail> {
  const row: Record<string, unknown> = { workspace_id: ws, updated_at: new Date().toISOString() };
  const int = (v: unknown, lo: number, hi: number) => { const n = Math.round(Number(v)); return n >= lo && n <= hi ? n : null; };
  if (p.dailyMax !== undefined) { const n = int(p.dailyMax, 1, 300); if (n === null) return fail(400, 'The daily maximum is 1 to 300.'); row.bc_daily_max = n; }
  if (p.from !== undefined) { if (!validTime(p.from)) return fail(400, 'The start time must look like 09:00.'); row.bc_from = p.from; }
  if (p.to !== undefined) { if (!validTime(p.to)) return fail(400, 'The end time must look like 19:00.'); row.bc_to = p.to; }
  if (p.gapMin !== undefined) { const n = int(p.gapMin, 30, 3600); if (n === null) return fail(400, 'The shortest pause is 30 seconds to 1 hour.'); row.bc_gap_min = n; }
  if (p.gapMax !== undefined) { const n = int(p.gapMax, 30, 7200); if (n === null) return fail(400, 'The longest pause is 30 seconds to 2 hours.'); row.bc_gap_max = n; }
  if (row.bc_gap_min && row.bc_gap_max && Number(row.bc_gap_min) > Number(row.bc_gap_max)) return fail(400, 'The shortest pause cannot be longer than the longest.');
  if (row.bc_from && row.bc_to && String(row.bc_from) >= String(row.bc_to)) return fail(400, 'The end time must be after the start time.');
  const { error } = await createAdminClient().from('wa_bot_config').upsert(row, { onConflict: 'workspace_id' });
  return error ? fail(500, /column/.test(error.message) ? 'The broadcast tables are not in the database yet: run the broadcast SQL first.' : error.message) : { ok: true };
}

// ---------------------------------------------------------------- who gets it
/** Every past lead of the WhatsApp sales number (private chats), minus those who said STOP. Newest chats first. */
async function audience(ws: string): Promise<{ list: Array<{ group_id: string; wa_id: string; name: string | null }>; optedOut: number }> {
  const db = createAdminClient();
  const { data: devs } = await db.from('wa_devices').select('id, phone').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  const waDevices = ((devs || []) as Array<{ id: string; phone: string }>).filter((d) => !/^(ig|fb):/.test(d.phone)).map((d) => d.id);
  if (!waDevices.length) return { list: [], optedOut: 0 };
  const [{ data: groups }, { data: outs }] = await Promise.all([
    db.from('wa_groups').select('id, wa_id, name, last_message_at').eq('workspace_id', ws).eq('is_group', false).in('device_id', waDevices).order('last_message_at', { ascending: false }).limit(5000),
    db.from('chat_optouts').select('wa_id').eq('workspace_id', ws).limit(10000),
  ]);
  const out = new Set(((outs || []) as Array<{ wa_id: string }>).map((o) => o.wa_id));
  const all = ((groups || []) as Array<{ id: string; wa_id: string; name: string | null }>).filter((g) => /^\d{8,16}$/.test(g.wa_id));
  return { list: all.filter((g) => !out.has(g.wa_id)).map((g) => ({ group_id: g.id, wa_id: g.wa_id, name: g.name })), optedOut: all.filter((g) => out.has(g.wa_id)).length };
}

export async function audiencePreview(ws: string) {
  const [a, s] = await Promise.all([audience(ws), bcSettings(ws)]);
  return { count: a.list.length, optedOut: a.optedOut, days: a.list.length ? daysNeeded(a.list.length, s) : 0 };
}

// ---------------------------------------------------------------- broadcasts
export async function createBroadcast(ws: string, input: { name?: unknown; message?: unknown }, by: string): Promise<{ ok: true; id: string; total: number; days: number } | Fail> {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const message = String(input.message ?? '').replace(/\r\n/g, '\n').trim();
  if (!name) return fail(400, 'Give the broadcast a name.');
  const variants = splitVariants(message);
  if (!variants.length) return fail(400, 'Write the message.');
  if (variants.some((v) => v.length > 1500)) return fail(400, 'One wording is too long (max 1500 characters).');
  const db = createAdminClient();
  const { data: running } = await db.from('chat_broadcasts').select('id').eq('workspace_id', ws).in('status', ['running', 'paused']).limit(1);
  if (running?.length) return fail(409, 'Another broadcast is still running or paused. Finish or cancel it first, so the daily limit protects the number.');
  const [a, s] = await Promise.all([audience(ws), bcSettings(ws)]);
  if (!a.list.length) return fail(400, 'Nobody to send to yet: no past WhatsApp leads (or all said STOP).');
  const { data: bc, error } = await db.from('chat_broadcasts').insert({ workspace_id: ws, name, message, status: 'running', total: a.list.length, next_send_at: new Date().toISOString(), created_by: by }).select('id').single();
  if (error || !bc) return fail(500, error?.message || 'Could not create the broadcast.');
  const id = (bc as any).id as string;
  const rows = a.list.map((r, i) => ({ broadcast_id: id, workspace_id: ws, group_id: r.group_id, wa_id: r.wa_id, name: r.name, position: i }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from('chat_broadcast_recipients').insert(rows.slice(i, i + 500));
    if (e) { await db.from('chat_broadcasts').delete().eq('id', id); return fail(500, e.message); }
  }
  return { ok: true, id, total: a.list.length, days: daysNeeded(a.list.length, s) };
}

async function countSentToday(ws: string, now = new Date()): Promise<number> {
  const { count } = await createAdminClient().from('chat_broadcast_recipients').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('status', 'sent').gte('sent_at', jakartaMidnight(now).toISOString());
  return count ?? 0;
}

export async function listBroadcasts(ws: string) {
  const db = createAdminClient();
  const [{ data }, settings, sentToday, preview] = await Promise.all([
    db.from('chat_broadcasts').select('id, name, message, status, total, next_send_at, paused_reason, created_by, created_at, finished_at').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(20),
    bcSettings(ws), countSentToday(ws), audiencePreview(ws),
  ]);
  const list = await Promise.all(((data || []) as any[]).map(async (b) => {
    const c = async (st: string) => (await db.from('chat_broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', b.id).eq('status', st)).count ?? 0;
    const [sent, failed, skipped] = await Promise.all([c('sent'), c('failed'), c('skipped')]);
    return { ...b, sent, failed, skipped, left: Math.max(0, b.total - sent - failed - skipped) };
  }));
  return { broadcasts: list, settings, sentToday, audience: preview };
}

export async function setBroadcastStatus(ws: string, id: string, action: unknown): Promise<{ ok: true } | Fail> {
  const db = createAdminClient();
  const { data: b } = await db.from('chat_broadcasts').select('id, status').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!b) return fail(404, 'Broadcast not found.');
  const st = (b as any).status as string;
  if (action === 'pause') { if (st !== 'running') return fail(400, 'Only a running broadcast can be paused.'); await db.from('chat_broadcasts').update({ status: 'paused', paused_reason: 'Paused by the team.' }).eq('id', id); return { ok: true }; }
  if (action === 'resume') { if (st !== 'paused') return fail(400, 'Only a paused broadcast can go on.'); await db.from('chat_broadcasts').update({ status: 'running', paused_reason: null, fails_in_row: 0, next_send_at: new Date().toISOString() }).eq('id', id); return { ok: true }; }
  if (action === 'cancel') {
    if (st === 'done' || st === 'cancelled') return fail(400, 'This broadcast has already ended.');
    await db.from('chat_broadcast_recipients').update({ status: 'skipped', error: 'Cancelled' }).eq('broadcast_id', id).eq('status', 'queued');
    await db.from('chat_broadcasts').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', id);
    return { ok: true };
  }
  return fail(400, 'Unknown action.');
}

// ---------------------------------------------------------------- the clock: one message per broadcast per tick
/** Sends the next message of each due broadcast, if the window and the daily maximum allow. Returns how many were sent. Never throws. */
export async function runBroadcasts(now = new Date()): Promise<number> {
  const db = createAdminClient();
  const { data: due } = await db.from('chat_broadcasts').select('id, workspace_id, message, fails_in_row').eq('status', 'running').lte('next_send_at', now.toISOString()).order('created_at', { ascending: true }).limit(20);
  let sent = 0;
  const seen = new Set<string>();
  for (const b of (due || []) as Array<{ id: string; workspace_id: string; message: string; fails_in_row: number }>) {
    if (seen.has(b.workspace_id)) continue;                     // one message per company per tick
    seen.add(b.workspace_id);
    try { if (await sendNext(b, now)) sent++; } catch (e) { console.error('broadcast step failed', e); }
  }
  return sent;
}

async function sendNext(b: { id: string; workspace_id: string; message: string; fails_in_row: number }, now: Date): Promise<boolean> {
  const db = createAdminClient();
  const ws = b.workspace_id;
  const s = await bcSettings(ws);
  const later = (at: Date) => db.from('chat_broadcasts').update({ next_send_at: at.toISOString() }).eq('id', b.id);

  // outside the window: wait for the next opening; daily maximum reached: wait for tomorrow's opening
  const opening = nextOpening(now, s);
  if (opening.getTime() > now.getTime()) { await later(opening); return false; }
  if ((await countSentToday(ws, now)) >= s.dailyMax) { await later(nextOpening(new Date(jakartaMidnight(now).getTime() + 86400000), s)); return false; }

  const { data: next } = await db.from('chat_broadcast_recipients').select('id, wa_id, name, position, group_id').eq('broadcast_id', b.id).eq('status', 'queued').order('position', { ascending: true }).limit(1).maybeSingle();
  if (!next) { await db.from('chat_broadcasts').update({ status: 'done', finished_at: now.toISOString() }).eq('id', b.id); return false; }
  const r = next as { id: string; wa_id: string; name: string | null; position: number; group_id: string | null };
  // claim it, so two clock calls never send the same message
  const { data: claimed } = await db.from('chat_broadcast_recipients').update({ status: 'sending' }).eq('id', r.id).eq('status', 'queued').select('id');
  if (!claimed?.length) return false;
  await later(new Date(now.getTime() + nextGapMs(s)));

  const { data: out } = await db.from('chat_optouts').select('wa_id').eq('workspace_id', ws).eq('wa_id', r.wa_id).maybeSingle();
  if (out) { await db.from('chat_broadcast_recipients').update({ status: 'skipped', error: 'Said STOP' }).eq('id', r.id); return false; }
  if (!process.env.FONNTE_TOKEN_SALES) { await db.from('chat_broadcast_recipients').update({ status: 'queued' }).eq('id', r.id); await db.from('chat_broadcasts').update({ status: 'paused', paused_reason: 'The sales number is not connected (FONNTE_TOKEN_SALES is missing).' }).eq('id', b.id); return false; }

  const text = composeMessage(b.message, r.position, r.name);
  const res = await sendWhatsApp([r.wa_id], text, { token: process.env.FONNTE_TOKEN_SALES });
  if (!res.ok) {
    await db.from('chat_broadcast_recipients').update({ status: 'failed', error: res.detail.slice(0, 200) }).eq('id', r.id);
    const fails = (b.fails_in_row ?? 0) + 1;
    await db.from('chat_broadcasts').update(fails >= MAX_FAILS_IN_ROW
      ? { fails_in_row: fails, status: 'paused', paused_reason: `${fails} messages failed in a row (${res.detail.slice(0, 120)}). Check the sales number in Fonnte, then press Continue.` }
      : { fails_in_row: fails }).eq('id', b.id);
    return false;
  }
  const at = new Date().toISOString();
  await db.from('chat_broadcast_recipients').update({ status: 'sent', sent_at: at, error: null }).eq('id', r.id);
  await db.from('chat_broadcasts').update({ fails_in_row: 0 }).eq('id', b.id);
  if (r.group_id) {
    const { data: dev } = await db.from('wa_groups').select('wa_devices(phone)').eq('id', r.group_id).maybeSingle();
    const phone = (Array.isArray((dev as any)?.wa_devices) ? (dev as any).wa_devices[0] : (dev as any)?.wa_devices)?.phone ?? null;
    await db.from('wa_messages').insert({ workspace_id: ws, group_id: r.group_id, sender_phone: phone, body: text, is_from_me: true, dedupe_key: `broadcast:${r.id}`, sent_at: at, source: 'broadcast', raw: { broadcast: b.id } });
    await db.from('wa_groups').update({ last_message_at: at }).eq('id', r.group_id);
  }
  return true;
}

// ---------------------------------------------------------------- STOP
/** A lead wrote STOP: never broadcast to them again, and say so once. */
export async function optOut(ws: string, groupId: string, waId: string): Promise<void> {
  const db = createAdminClient();
  await db.from('chat_optouts').upsert({ workspace_id: ws, wa_id: waId, reason: 'Replied STOP' }, { onConflict: 'workspace_id,wa_id' });
  const r = await sendToChat(groupId, waId, STOP_REPLY);
  if (r.ok) await db.from('wa_messages').insert({ workspace_id: ws, group_id: groupId, body: STOP_REPLY, is_from_me: true, dedupe_key: `optout:${groupId}:${Date.now()}`, sent_at: new Date().toISOString(), source: 'bot', raw: { bot: true } });
}
