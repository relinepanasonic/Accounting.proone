import { createAdminClient } from '@/lib/api/supabase-admin';
import { forget, memo } from './cache';
import { cleanSource, matchSource, sourceReport, type SourceDef } from './lead-source';

/**
 * Lead sources (server side): the catalog of ads and their first messages, finding the source of each new WhatsApp lead, setting it by hand,
 * copying it to the ERP client, and the report. The pure rules are in lead-source.ts.
 */

type Who = { userId: string; name: string };
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

const catalog = (ws: string) => memo(`sources:${ws}`, 30_000, async () => {
  const { data } = await createAdminClient().from('lead_sources').select('id, name, channel, first_message, active, created_at, created_by').eq('workspace_id', ws).order('created_at', { ascending: false });
  return (data || []) as Array<SourceDef & { created_at: string; created_by: string | null }>;
});

export const listSources = (ws: string) => catalog(ws);

export async function saveSource(ws: string, input: { id?: string; name?: unknown; channel?: unknown; first_message?: unknown; active?: unknown }, by: Who): Promise<{ ok: true } | Fail> {
  const c = cleanSource(input);
  if (!c.ok) return fail(400, c.error);
  const db = createAdminClient();
  const active = input.active === false ? false : true;
  if (input.id) {
    const { data, error } = await db.from('lead_sources').update({ ...c.value, active }).eq('id', input.id).eq('workspace_id', ws).select('id').maybeSingle();
    if (error) return fail(500, error.message);
    if (!data) return fail(404, 'Source not found.');
  } else {
    const { error } = await db.from('lead_sources').insert({ workspace_id: ws, ...c.value, active, created_by: by.name });
    if (error) return fail(500, error.message);
  }
  forget(`sources:${ws}`);
  return { ok: true };
}

export async function deleteSource(ws: string, id: string): Promise<{ ok: true } | Fail> {
  const { error } = await createAdminClient().from('lead_sources').delete().eq('id', id).eq('workspace_id', ws);
  forget(`sources:${ws}`);
  return error ? fail(500, error.message) : { ok: true };
}

// ---------------------------------------------------------------- finding the source of a chat
/** The oldest message the lead wrote in this chat (it is the "first message"), or null. */
async function firstInbound(groupId: string): Promise<{ body: string; sent_at: string } | null> {
  const { data } = await createAdminClient().from('wa_messages').select('body, sent_at').eq('group_id', groupId).eq('is_from_me', false).not('body', 'is', null).order('sent_at', { ascending: true }).limit(1).maybeSingle();
  const row = data as { body: string; sent_at: string } | null;
  return row && String(row.body).trim() ? row : null;
}

/**
 * Remembers the first message of a chat and finds its source. Does nothing when a person already set the source, or when this was done before and
 * `redo` is false. Called after every new lead message on the sales number, and by "Re-check chats". Never throws into the webhook.
 */
export async function captureLeadSource(ws: string, groupId: string, opts: { redo?: boolean } = {}): Promise<'set' | 'unknown' | 'kept' | 'none'> {
  const db = createAdminClient();
  const { data: st } = await db.from('chat_state').select('first_message, source_by, source_id').eq('group_id', groupId).maybeSingle();
  const state = st as { first_message: string | null; source_by: string | null; source_id: string | null } | null;
  if (state?.source_by && state.source_by !== 'auto') return 'kept';                    // a person chose it
  if (state?.first_message && !opts.redo) return 'kept';

  const first = state?.first_message ? { body: state.first_message, sent_at: null as string | null } : await firstInbound(groupId);
  if (!first) return 'none';
  const found = matchSource(first.body, await catalog(ws));
  const patch: Record<string, unknown> = {
    group_id: groupId, workspace_id: ws, updated_at: new Date().toISOString(),
    first_message: first.body.slice(0, 600), ...(first.sent_at ? { first_message_at: first.sent_at } : {}),
    source_id: found?.source.id ?? null, source_label: found?.source.name ?? null, source_channel: found?.source.channel ?? 'unknown', source_by: 'auto',
  };
  const { error } = await db.from('chat_state').upsert(patch, { onConflict: 'group_id' });
  if (error) return 'none';
  return found ? 'set' : 'unknown';
}

/** A person says where this lead came from (or clears it with sourceId null). */
export async function setChatSource(ws: string, groupId: string, sourceId: string | null, by: Who): Promise<{ ok: true; source: { id: string | null; label: string | null; channel: string } } | Fail> {
  const db = createAdminClient();
  const { data: g } = await db.from('wa_groups').select('id').eq('id', groupId).eq('workspace_id', ws).maybeSingle();
  if (!g) return fail(404, 'Chat not found.');
  let label: string | null = null; let channel = 'unknown';
  if (sourceId) {
    const s = (await catalog(ws)).find((x) => x.id === sourceId);
    if (!s) return fail(400, 'That source does not exist.');
    label = s.name; channel = s.channel;
  }
  const first = await firstInbound(groupId);
  const { error } = await db.from('chat_state').upsert({
    group_id: groupId, workspace_id: ws, updated_at: new Date().toISOString(),
    source_id: sourceId, source_label: label, source_channel: channel, source_by: sourceId ? by.name : 'auto',
    ...(first ? { first_message: first.body.slice(0, 600), first_message_at: first.sent_at } : {}),
  }, { onConflict: 'group_id' });
  if (error) return fail(500, error.message);
  return { ok: true, source: { id: sourceId, label, channel } };
}

/** Copies the source to the ERP client record when the chat belongs to a client that has none yet. Fire and forget. */
export async function syncClientSource(clientId: string, chat: { source_label: string | null; source_channel: string | null; first_message: string | null; first_message_at: string | null }) {
  if (!chat.first_message) return;
  try {
    await createAdminClient().from('clients').update({
      lead_source: chat.source_label, lead_channel: chat.source_channel && chat.source_channel !== 'unknown' ? chat.source_channel : null,
      first_contact_message: chat.first_message, first_contact_at: chat.first_message_at,
    }).eq('id', clientId).is('lead_source', null).is('first_contact_message', null);
  } catch { /* ignore */ }
}

/** Looks at every chat of the sales number again: records the first message of chats that have none, and re-matches chats nobody set by hand against the current catalog. */
export async function rescanSources(ws: string): Promise<{ ok: true; checked: number; matched: number }> {
  const db = createAdminClient();
  const { data: devs } = await db.from('wa_devices').select('id').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  const ids = (devs || []).map((d: any) => d.id as string);
  if (!ids.length) return { ok: true, checked: 0, matched: 0 };
  const { data: groups } = await db.from('wa_groups').select('id').eq('workspace_id', ws).eq('is_group', false).in('device_id', ids).limit(500);
  forget(`sources:${ws}`);
  let matched = 0; let checked = 0;
  for (const g of (groups || []) as Array<{ id: string }>) {
    const r = await captureLeadSource(ws, g.id, { redo: true });
    if (r !== 'none' && r !== 'kept') checked++;
    if (r === 'set') matched++;
  }
  return { ok: true, checked, matched };
}

// ---------------------------------------------------------------- the report
export async function reportData(ws: string, days: number) {
  const db = createAdminClient();
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86400000).toISOString();
  const [{ data: chats }, { data: clients }, { data: deals }, sources] = await Promise.all([
    db.from('chat_state').select('group_id, first_message, first_message_at, source_id, source_label, source_channel, wa_groups(wa_id, name)').eq('workspace_id', ws).gte('first_message_at', since).limit(3000),
    db.from('clients').select('id, phone').eq('workspace_id', ws).not('phone', 'is', null).limit(3000),
    db.from('crm_deals').select('client_id, stage, value').eq('workspace_id', ws).limit(5000),
    catalog(ws),
  ]);
  const rows = ((chats || []) as any[]).map((c) => ({ ...c, wa_id: String(Array.isArray(c.wa_groups) ? c.wa_groups[0]?.wa_id : c.wa_groups?.wa_id || ''), name: String(Array.isArray(c.wa_groups) ? c.wa_groups[0]?.name : c.wa_groups?.name || '') }));
  const report = sourceReport(rows, (clients || []) as any[], (deals || []) as any[]);
  const unmatched = rows.filter((r) => !r.source_id && r.first_message).sort((a, b) => String(b.first_message_at).localeCompare(String(a.first_message_at))).slice(0, 25)
    .map((r) => ({ group_id: r.group_id as string, name: (r.name || `+${r.wa_id}`) as string, first_message: r.first_message as string, at: r.first_message_at as string }));
  return { days, ...report, unmatched, sources: sources.length };
}
