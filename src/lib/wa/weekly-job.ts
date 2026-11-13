import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadStorePerformance } from '@/lib/integrations/store-performance';
import { storeKeyOf, storeLabel, type PerfRow } from '@/lib/integrations/performance';
import { fetchTopProducts, productsKey } from '@/lib/integrations/top-products';
import { clientGroupMap, pickGroup } from './group-pick';
import { jakartaDate } from './report-text';
import { hasActivity, lastFullWeek, seriesFrom, sumRows, weeklyCaption, weeklyFigures, weeklyFileName, weeklySeries, type WeeklyPayload } from './weekly';
import { sendWhatsApp } from './send';
import { asDelivery, sendMedia } from './send-media';
import { adminMediaStorage } from './media-storage';
import { renderWeeklyPdf } from './weekly-pdf';
import { renderWeeklyJpeg } from './report-image';

const addDaysIso = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

export interface PrepareResult { from: string; to: string; created: number; refreshed: number; kept: number; noData: number; errors: string[] }

/**
 * Prepares one DRAFT per store for the last full week (Monday to Sunday). It never sends anything.
 * A draft that already exists is left alone (an admin may have edited it) unless `refresh` is true; sent and skipped ones are never touched.
 */
export async function prepareClientWeekly(workspaceId: string, opts: { today?: string; refresh?: boolean; onlyKey?: string; week?: string } = {}): Promise<PrepareResult> {
  const db = createAdminClient();
  // a given Monday is that week; else the last full week before today
  const week = opts.week ? { from: opts.week, to: addDaysIso(opts.week, 6), prevFrom: addDaysIso(opts.week, -7), prevTo: addDaysIso(opts.week, -1) } : lastFullWeek(opts.today || jakartaDate());
  const res: PrepareResult = { from: week.from, to: week.to, created: 0, refreshed: 0, kept: 0, noData: 0, errors: [] };

  // The feeds of Dashboard Prof and Reline, for every store (the owner view): the report week and the 4 weeks before it (the charts),
  // and the best-selling products of the report week. Products are best effort: an app that does not send them yet leaves page 2 without the list.
  const [perf, prodDash, prodReline] = await Promise.all([
    loadStorePerformance({ from: seriesFrom(week.from), to: week.to }, { userId: null, role: 'founder' }),
    fetchTopProducts('dashboard', week.from, week.to),
    fetchTopProducts('reline', week.from, week.to),
  ]);
  res.errors.push(...perf.errors);
  const productsOf = new Map<string, { name: string; sales: number }[]>();
  for (const r of [prodDash, prodReline]) if (r.ok) for (const s of r.stores) if (s.products.length) productsOf.set(productsKey(s), s.products);
  const productErrors = [prodDash, prodReline].flatMap((r, i) => (r.ok ? [] : [`${i === 0 ? 'Profesor Dashboard' : 'Reline'}: ${r.error}`]));
  if (productErrors.length) res.errors.push(`Top products (the PDF's page 2 list): ${productErrors.join(' | ')}`);

  const byStore = new Map<string, PerfRow[]>();
  for (const r of perf.rows) {
    const k = storeKeyOf(r);
    const list = byStore.get(k) || [];
    list.push(r);
    byStore.set(k, list);
  }

  const [{ data: links }, { data: existingRows }, { data: clients }] = await Promise.all([
    db.from('wa_store_groups').select('store_label, group_id').eq('workspace_id', workspaceId),
    db.from('wa_outbox').select('id, store_label, status').eq('workspace_id', workspaceId).eq('kind', 'client-weekly').eq('period_from', week.from),
    db.from('clients').select('name, company_name, wa_group_id').eq('workspace_id', workspaceId).not('wa_group_id', 'is', null),
  ]);
  const storeGroup = new Map<string, string>((links || []).map((l: any) => [l.store_label as string, l.group_id as string]));
  // the group set on a store of a client (Optimizing > Clients) wins
  try {
    const { data: own } = await db.from('client_stores').select('company, store, wa_group_id').not('wa_group_id', 'is', null);
    for (const o of own || []) storeGroup.set(`${o.company} - ${o.store}`, o.wa_group_id as string);
  } catch { /* column not there yet */ }
  const clientGroup = clientGroupMap((clients || []) as any[]);
  const existing = new Map<string, { id: string; status: string }>((existingRows || []).map((e: any) => [e.store_label as string, { id: e.id as string, status: e.status as string }]));

  const inserts: Record<string, unknown>[] = [];
  for (const [key, rows] of byStore) {
    if (opts.onlyKey && key !== opts.onlyKey) continue;      // one store only (asked by Dashboard Prof / Reline)
    const cur = sumRows(rows, week.from, week.to);
    if (!hasActivity(cur)) { res.noData++; continue; }
    const label = storeLabel(rows[0]);
    const client = perf.teams[key]?.client || '';
    const payload: WeeklyPayload = {
      store: label, client, from: week.from, to: week.to, cur: cur!, prev: sumRows(rows, week.prevFrom, week.prevTo),
      series: weeklySeries(rows, week.from), products: productsOf.get(key) || null,
    };
    const fields = { client_name: client || null, group_id: pickGroup(label, client, storeGroup, clientGroup), message: weeklyCaption(payload), payload, detail: null as string | null };

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
 * cannot send the same summary twice. With "send PDFs as files" ON (Fonnte Super package) the message is the PDF with the caption;
 * otherwise (or with asText) it is the caption followed by the numbers as text.
 */
export async function sendOutboxItem(workspaceId: string, userId: string | null, id: string, opts: { message?: string; asText?: boolean; resend?: boolean } = {}): Promise<OutboxSendResult> {
  const db = createAdminClient();
  const { data: item } = await db.from('wa_outbox').select('id, status, group_id, message, payload').eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
  if (!item) return { ok: false, detail: 'Summary not found.' };
  const wasSent = item.status === 'sent';
  if (item.status !== 'draft' && item.status !== 'failed' && !(wasSent && opts.resend)) return { ok: false, detail: wasSent ? 'Already sent. Use Send again to send it once more.' : `It is ${item.status}.` };
  if (!item.group_id) return { ok: false, detail: 'Link a WhatsApp group to this client first.' };
  const { data: group } = await db.from('wa_groups').select('wa_id, is_group').eq('id', item.group_id).eq('workspace_id', workspaceId).maybeSingle();
  if (!group) return { ok: false, detail: 'The linked group no longer exists.' };

  const caption = (opts.message ?? item.message).trim();
  if (!caption) return { ok: false, detail: 'The message is empty.' };
  const payload = item.payload as WeeklyPayload | null;

  const { data: settings } = await db.from('wa_settings').select('send_files, image_delivery').eq('workspace_id', workspaceId).maybeSingle();
  const asFile = !!settings?.send_files && !!payload?.cur && !opts.asText;

  const { data: claimed } = await db.from('wa_outbox').update({ status: 'sending', message: caption }).eq('id', id).in('status', wasSent ? ['sent'] : ['draft', 'failed']).select('id');
  if (!claimed || claimed.length === 0) return { ok: false, detail: 'Someone else is sending this one.' };

  const target = group.is_group ? `${group.wa_id}@g.us` : group.wa_id;
  let r;
  let sentAs = 'Text';
  if (asFile) {
    // The report is drawn here from the numbers saved with the draft and uploaded to Fonnte as a real file: a JPG (it shows inline in the
    // chat), or the PDF if the image cannot be made.
    const pdfName = weeklyFileName(payload!.store, payload!.from, payload!.to);
    let file: { data: Uint8Array; filename: string; contentType: string } | null = null;
    try { file = { data: await renderWeeklyJpeg(payload!), filename: pdfName.replace(/\.pdf$/i, '.jpg'), contentType: 'image/jpeg' }; } catch { /* use the PDF */ }
    if (!file) {
      try { file = { data: new Uint8Array(await renderWeeklyPdf(payload!)), filename: pdfName, contentType: 'application/pdf' }; }
      catch (e: any) { r = { ok: false, parts: 0, detail: `Could not make the report: ${e?.message || e}` }; }
    }
    if (file) {
      const isJpg = file.contentType === 'image/jpeg';
      const month = (payload!.from || '').slice(0, 7);
      const sent = await sendMedia({ phones: [target], caption, ...file, path: `weekly/${workspaceId}/${month}/${id}.${isJpg ? 'jpg' : 'pdf'}`, delivery: asDelivery(settings?.image_delivery), storage: adminMediaStorage() });
      r = sent;
      sentAs = `${isJpg ? 'Image' : 'PDF'} by ${sent.mode}`;
    }
  } else {
    r = await sendWhatsApp([target], payload?.cur ? `${caption}\n\n${weeklyFigures(payload.cur, payload.prev)}` : caption);
  }
  r = r!;
  const detail = `${sentAs}: ${r.detail}`;
  if (r.ok) await db.from('wa_outbox').update({ status: 'sent', detail: wasSent ? `Sent again. ${detail}` : detail, sent_at: new Date().toISOString(), sent_by: userId }).eq('id', id);
  // a failed resend leaves the report marked as sent (it was), and says what went wrong
  else await db.from('wa_outbox').update(wasSent ? { status: 'sent', detail: `Send again failed: ${detail}` } : { status: 'failed', detail, sent_at: null, sent_by: null }).eq('id', id);
  return { ok: r.ok, detail };
}
