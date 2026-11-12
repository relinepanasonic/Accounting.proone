import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadStorePerformance } from '@/lib/integrations/store-performance';
import { storeKeyOf, storeLabel, type PerfRow } from '@/lib/integrations/performance';
import { jakartaDate } from './report-text';
import { hasActivity, lastFullWeek, sumRows, weeklyMessage } from './weekly';
import { sendWhatsApp } from './send';

export interface PrepareResult { from: string; to: string; created: number; refreshed: number; kept: number; noData: number; errors: string[] }

/**
 * Prepares one DRAFT per store for the last full week (Monday to Sunday). It never sends anything.
 * A draft that already exists is left alone (an admin may have edited it) unless `refresh` is true; sent and skipped ones are never touched.
 */
export async function prepareClientWeekly(workspaceId: string, opts: { today?: string; refresh?: boolean } = {}): Promise<PrepareResult> {
  const db = createAdminClient();
  const week = lastFullWeek(opts.today || jakartaDate());
  const res: PrepareResult = { from: week.from, to: week.to, created: 0, refreshed: 0, kept: 0, noData: 0, errors: [] };

  // The feeds of Dashboard Prof and Reline, for every store (the owner view).
  const perf = await loadStorePerformance({ from: week.prevFrom, to: week.to }, { userId: null, role: 'founder' });
  res.errors.push(...perf.errors);

  const byStore = new Map<string, PerfRow[]>();
  for (const r of perf.rows) {
    const k = storeKeyOf(r);
    const list = byStore.get(k) || [];
    list.push(r);
    byStore.set(k, list);
  }

  const [{ data: links }, { data: existingRows }] = await Promise.all([
    db.from('wa_store_groups').select('store_label, group_id').eq('workspace_id', workspaceId),
    db.from('wa_outbox').select('id, store_label, status').eq('workspace_id', workspaceId).eq('kind', 'client-weekly').eq('period_from', week.from),
  ]);
  const groupOf = new Map<string, string>((links || []).map((l: any) => [l.store_label as string, l.group_id as string]));
  const existing = new Map<string, { id: string; status: string }>((existingRows || []).map((e: any) => [e.store_label as string, { id: e.id as string, status: e.status as string }]));

  const inserts: Record<string, unknown>[] = [];
  for (const [key, rows] of byStore) {
    const cur = sumRows(rows, week.from, week.to);
    if (!hasActivity(cur)) { res.noData++; continue; }
    const label = storeLabel(rows[0]);
    const client = perf.teams[key]?.client || '';
    const message = weeklyMessage({ client, store: label, from: week.from, to: week.to, cur: cur!, prev: sumRows(rows, week.prevFrom, week.prevTo) });
    const fields = { client_name: client || null, group_id: groupOf.get(label) || null, message, detail: null as string | null };

    const ex = existing.get(label);
    if (!ex) {
      inserts.push({ workspace_id: workspaceId, kind: 'client-weekly', store_label: label, period_from: week.from, period_to: week.to, status: 'draft', ...fields });
    } else if (opts.refresh && (ex.status === 'draft' || ex.status === 'failed')) {
      const { error } = await db.from('wa_outbox').update({ ...fields, status: 'draft', prepared_at: new Date().toISOString() }).eq('id', ex.id);
      if (error) res.errors.push(`${label}: ${error.message}`); else res.refreshed++;
    } else {
      res.kept++;
      // A group linked after the draft was made still counts.
      if (ex.status === 'draft' && fields.group_id) await db.from('wa_outbox').update({ group_id: fields.group_id }).eq('id', ex.id).is('group_id', null);
    }
  }
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100);
    const { error } = await db.from('wa_outbox').insert(chunk);
    if (error) res.errors.push(error.message); else res.created += chunk.length;
  }
  return res;
}

export interface OutboxSendResult { ok: boolean; detail: string }

/**
 * Sends one approved draft to its client group. The row is claimed first (draft/failed -> sending), so a double click or two admins
 * cannot send the same summary twice.
 */
export async function sendOutboxItem(workspaceId: string, userId: string, id: string, editedMessage?: string): Promise<OutboxSendResult> {
  const db = createAdminClient();
  const { data: item } = await db.from('wa_outbox').select('id, status, group_id, message').eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
  if (!item) return { ok: false, detail: 'Summary not found.' };
  if (item.status !== 'draft' && item.status !== 'failed') return { ok: false, detail: item.status === 'sent' ? 'Already sent.' : `It is ${item.status}.` };
  if (!item.group_id) return { ok: false, detail: 'Link a WhatsApp group to this store first.' };
  const { data: group } = await db.from('wa_groups').select('wa_id, is_group').eq('id', item.group_id).eq('workspace_id', workspaceId).maybeSingle();
  if (!group) return { ok: false, detail: 'The linked group no longer exists.' };

  const text = (editedMessage ?? item.message).trim();
  if (!text) return { ok: false, detail: 'The message is empty.' };

  const { data: claimed } = await db.from('wa_outbox').update({ status: 'sending', message: text }).eq('id', id).in('status', ['draft', 'failed']).select('id');
  if (!claimed || claimed.length === 0) return { ok: false, detail: 'Someone else is sending this one.' };

  const target = group.is_group ? `${group.wa_id}@g.us` : group.wa_id;
  const r = await sendWhatsApp([target], text);
  await db.from('wa_outbox').update({ status: r.ok ? 'sent' : 'failed', detail: r.detail, sent_at: r.ok ? new Date().toISOString() : null, sent_by: r.ok ? userId : null }).eq('id', id);
  return { ok: r.ok, detail: r.detail };
}
