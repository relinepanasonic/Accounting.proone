import { createAdminClient } from '@/lib/api/supabase-admin';
import { PRE_MEETING_STAGES } from '@/lib/sales/flow';
import { findChatDeal } from './pipeline';

/**
 * Junk leads. A chat that is not a lead (a verification code, a company's automatic greeting, or marked "Not a lead") may already have an ERP lead and a
 * prospect client made by the automation. They are ARCHIVED, not deleted: stage "Archived" hides the deal from the pipeline, the reports and the stats, and
 * "This is a lead" restores it. On the last day of every month the cleanup deletes what is still archived (see cleanupArchivedJunk).
 * Only a lead that never got anywhere is archived: a deal that reached a meeting, an invoice or a payment is a real lead and is never touched.
 */
export const ARCHIVED_STAGE = 'Archived';

/** Is this deal a junk candidate: never past an offered meeting, no invoice, not paid. */
export const canArchive = (d: { stage: string; invoice_id?: string | null; paid_at?: string | null }) =>
  PRE_MEETING_STAGES.includes(d.stage) && !d.invoice_id && !d.paid_at;

/** True on the last day of the month (Jakarta time), when the cleanup runs. */
export function isLastDayOfMonth(now: Date): boolean {
  const jkt = new Date(now.getTime() + 7 * 3600000);
  const tomorrow = new Date(jkt.getTime() + 86400000);
  return tomorrow.getUTCMonth() !== jkt.getUTCMonth();
}

/** Archives the chat's lead if it is a junk candidate. Returns what it did. Never throws. */
export async function archiveJunkLead(ws: string, groupId: string, waId: string): Promise<'archived' | 'kept' | 'none'> {
  try {
    const deal = await findChatDeal(ws, waId, groupId);
    if (!deal) return 'none';
    const db = createAdminClient();
    const { data: d } = await db.from('crm_deals').select('id, stage, invoice_id, paid_at').eq('id', deal.id).maybeSingle();
    if (!d || !canArchive(d as any)) return 'kept';
    const { data: meet } = await db.from('chat_meetings').select('id').eq('group_id', groupId).limit(1);
    if (meet?.length) return 'kept';                            // a booked consultation: a real lead
    const now = new Date().toISOString();
    await db.from('crm_deals').update({ stage: ARCHIVED_STAGE, archived_from: (d as any).stage, archived_at: now, stage_changed_at: now, updated_at: now }).eq('id', deal.id);
    return 'archived';
  } catch (e) { console.error('archive junk lead failed', e); return 'none'; }
}

/** "This is a lead": the archived deal goes back to the stage it had. Never throws. */
export async function restoreJunkLead(groupId: string): Promise<boolean> {
  try {
    const db = createAdminClient();
    const { data: st } = await db.from('chat_state').select('deal_id').eq('group_id', groupId).maybeSingle();
    const id = (st as any)?.deal_id as string | null;
    if (!id) return false;
    const { data: d } = await db.from('crm_deals').select('id, stage, archived_from').eq('id', id).maybeSingle();
    if (!d || (d as any).stage !== ARCHIVED_STAGE) return false;
    const now = new Date().toISOString();
    await db.from('crm_deals').update({ stage: (d as any).archived_from || 'Lead', archived_from: null, archived_at: null, stage_changed_at: now, updated_at: now }).eq('id', id);
    return true;
  } catch (e) { console.error('restore junk lead failed', e); return false; }
}

/**
 * Deletes a client that is only a prospect with nothing attached (no other deal, invoice, project, report, assignment, store, visit or invoice request), because
 * deleting a client cascades. Returns whether it was deleted. Call it after the deal itself is gone.
 */
export async function deleteBareProspect(clientId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: cl } = await db.from('clients').select('id, is_prospect').eq('id', clientId).maybeSingle();
  if (!(cl as any)?.is_prospect) return false;
  const counts = await Promise.all(['crm_deals', 'invoices', 'projects', 'advertiser_reports', 'client_assignments', 'client_stores', 'lead_visits', 'invoice_requests'].map(async (t) => (await db.from(t).select('id', { count: 'exact', head: true }).eq('client_id', clientId)).count ?? 0));
  if (counts.some((n) => n > 0)) return false;
  await db.from('clients').delete().eq('id', clientId);
  return true;
}

/**
 * The month-end cleanup: deletes the deals still archived, and the prospect client of each only when that client is a bare prospect (no other deal, invoice,
 * project, report, assignment, store, visit or invoice request), because deleting a client cascades. A deal with an invoice or a project is left archived.
 * Runs only on the last day of the month unless `force`. Returns the counts.
 */
export async function cleanupArchivedJunk(opts: { now?: Date; force?: boolean } = {}): Promise<{ ran: boolean; deals: number; clients: number; skipped: number }> {
  const now = opts.now ?? new Date();
  if (!opts.force && !isLastDayOfMonth(now)) return { ran: false, deals: 0, clients: 0, skipped: 0 };
  const db = createAdminClient();
  const { data: deals } = await db.from('crm_deals').select('id, client_id, invoice_id, paid_at').eq('stage', ARCHIVED_STAGE).limit(2000);
  let nDeals = 0, nClients = 0, skipped = 0;
  for (const d of (deals || []) as Array<{ id: string; client_id: string | null; invoice_id: string | null; paid_at: string | null }>) {
    const [{ count: reqs }, { count: projs }] = await Promise.all([
      db.from('invoice_requests').select('id', { count: 'exact', head: true }).eq('deal_id', d.id),
      db.from('projects').select('id', { count: 'exact', head: true }).eq('deal_id', d.id),
    ]);
    if (d.invoice_id || d.paid_at || (reqs ?? 0) > 0 || (projs ?? 0) > 0) { skipped++; continue; }
    await db.from('crm_deals').delete().eq('id', d.id);
    nDeals++;
    if (d.client_id && (await deleteBareProspect(d.client_id))) nClients++;
  }
  return { ran: true, deals: nDeals, clients: nClients, skipped };
}
