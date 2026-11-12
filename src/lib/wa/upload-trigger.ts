import { createAdminClient } from '@/lib/api/supabase-admin';
import { getDashboardUploadLogRange, getRelineUploadLogRange, jakartaDay } from '@/lib/integrations/dashboard-uploads';
import { buildMonthTable, normalizeLogs, type MonthStoreRow } from '@/lib/integrations/upload-performance';
import { buildChecklist, reportMondayOfBlock } from '@/lib/integrations/upload-checklist';
import { storeKeyOf, storeLabel } from '@/lib/integrations/performance';
import { prepareClientWeekly, sendOutboxItem } from './weekly-job';

/** The report identity of a store of the upload feed (the same key and label the weekly report uses). */
export const reportIdOf = (r: Pick<MonthStoreRow, 'project' | 'store' | 'workspace'>) => ({ source: (r.project === 'profesor' ? 'dashboard' : 'reline') as 'dashboard' | 'reline', store: r.store, workspace: r.workspace });

export interface ReportStatus { status: string; sentAt: string | null; hasGroup: boolean }

/** The weekly report of each store for a month: "<label>|<Monday>" -> where it stands (draft, sent, failed...). */
export async function loadReportStatuses(workspaceId: string, from: string, to: string): Promise<Record<string, ReportStatus>> {
  const out: Record<string, ReportStatus> = {};
  try {
    const { data } = await createAdminClient().from('wa_outbox').select('store_label, period_from, status, sent_at, group_id').eq('workspace_id', workspaceId).eq('kind', 'client-weekly').gte('period_from', from).lte('period_from', to);
    for (const r of data || []) out[`${r.store_label}|${r.period_from}`] = { status: r.status, sentAt: r.sent_at || null, hasGroup: !!r.group_id };
  } catch { /* the table is not there: no status */ }
  return out;
}

export interface SendOneResult { ok: boolean; detail: string; sent?: boolean }

/** Builds (from the latest numbers) and sends the weekly report of one store and week. Never sends a second time unless `resend`. */
export async function sendStoreWeek(workspaceId: string, userId: string | null, id: { source: 'dashboard' | 'reline'; store: string; workspace: string }, monday: string, opts: { resend?: boolean } = {}): Promise<SendOneResult> {
  const db = createAdminClient();
  const label = storeLabel(id);
  const find = () => db.from('wa_outbox').select('id, status, group_id').eq('workspace_id', workspaceId).eq('kind', 'client-weekly').eq('store_label', label).eq('period_from', monday).maybeSingle();
  let { data: row } = await find();
  if (row?.status === 'sent' && !opts.resend) return { ok: false, detail: 'Already sent.' };
  if (!row || row.status === 'draft' || row.status === 'failed') {
    const prep = await prepareClientWeekly(workspaceId, { onlyKey: storeKeyOf(id), week: monday, refresh: true });
    ({ data: row } = await find());
    if (!row) return { ok: false, detail: `There are no numbers for ${label} in the week of ${monday} yet.${prep.errors[0] ? ` ${prep.errors[0]}` : ''}` };
  }
  if (!row.group_id) return { ok: false, detail: 'This client has no WhatsApp group linked yet (Optimizing > Clients).' };
  const r = await sendOutboxItem(workspaceId, userId, row.id, { resend: opts.resend });
  return { ok: r.ok, detail: r.detail, sent: r.ok };
}

export interface TriggerResult { checked: number; ready: number; sent: string[]; skipped: string[]; errors: string[] }

/**
 * The automatic trigger: every store whose 5 weekly files are all uploaded (Store, Product, Ads Total, Ads Inkubasi/GMV Max, Ads Group) and whose
 * report was not sent yet gets its weekly report sent to the client's group. Only weeks of the last 21 days (nothing old is ever sent).
 */
export async function sendReadyWeeklyReports(workspaceId: string, opts: { today?: string; dryRun?: boolean } = {}): Promise<TriggerResult> {
  const today = opts.today || jakartaDay(new Date());
  const res: TriggerResult = { checked: 0, ready: 0, sent: [], skipped: [], errors: [] };
  const cutoff = jakartaDay(new Date(new Date(`${today}T12:00:00+07:00`).getTime() - 21 * 86400000));
  const months = Array.from(new Set([cutoff.slice(0, 7), today.slice(0, 7)]));
  const statuses: Record<string, ReportStatus> = {};
  for (const m of months) {
    const [y, mo] = m.split('-').map(Number);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const from = `${m}-01`;
    const to = `${m}-${String(last).padStart(2, '0')}`;
    const [prof, reline] = await Promise.all([getDashboardUploadLogRange(from, to), getRelineUploadLogRange(from, to)]);
    const { rows, assigned, errors } = normalizeLogs(prof, reline);
    res.errors.push(...errors);
    Object.assign(statuses, await loadReportStatuses(workspaceId, from, to));
    for (const store of buildMonthTable(rows, assigned, y, mo, () => '')) {
      for (let b = 0; b < 5; b++) {
        const files = store.weekFiles[b];
        if (!files?.length) continue;
        res.checked++;
        if (!buildChecklist(files).complete) continue;
        const monday = reportMondayOfBlock(y, mo, b);
        if (!monday || monday < cutoff || monday > today) continue;
        res.ready++;
        const id = reportIdOf(store);
        const label = storeLabel(id);
        if (statuses[`${label}|${monday}`]?.status === 'sent' || statuses[`${label}|${monday}`]?.status === 'skipped') { res.skipped.push(`${label} ${monday}: already handled`); continue; }
        if (opts.dryRun) { res.sent.push(`${label} ${monday} (dry run)`); continue; }
        try {
          const r = await sendStoreWeek(workspaceId, null, id, monday);
          if (r.sent) res.sent.push(`${label} ${monday}`); else res.skipped.push(`${label} ${monday}: ${r.detail}`);
        } catch (e: any) { res.errors.push(`${label} ${monday}: ${e?.message || e}`); }
      }
    }
  }
  return res;
}
