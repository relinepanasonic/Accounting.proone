import { NextResponse } from 'next/server';
import { authorizeErpApi } from '@/lib/api/erp-report';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { storeKeyOf, storeLabel } from '@/lib/integrations/performance';
import { parseAppWeeklyRequest } from '@/lib/wa/app-weekly-request';
import { prepareClientWeekly, sendOutboxItem } from '@/lib/wa/weekly-job';
import { lastFullWeek } from '@/lib/wa/weekly';
import { jakartaDate } from '@/lib/wa/report-text';
import { signedWeeklyImageUrl } from '@/lib/wa/signed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NO_STORE = { 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/**
 * POST /api/v1/erp/wa/client-weekly: Dashboard Prof and Reline use it so the ADMIN who uploads the weekly numbers can send that store's weekly
 * report (an image) to the client's WhatsApp group, from Oli's number, without opening the ERP.
 * Header: Authorization: Bearer <ERP_API_KEY>. Body: { source, store, workspace?, week?, action: "preview" | "send", resend?, sentBy? }.
 *  - preview: builds the report from the latest numbers and returns a link to the image (valid 1 hour) and the group it would go to.
 *  - send: the same, then sends it to the client's group. 409 when the client has no group (no_group) or it was already sent (already_sent, unless resend).
 */
export async function POST(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: NO_STORE });
  let body: unknown;
  try { body = await request.json(); } catch { return reply({ error: 'bad_request', message: 'The body must be JSON.' }, 400); }
  const parsed = parseAppWeeklyRequest(body);
  if (!parsed.ok) return reply({ error: 'bad_request', message: parsed.error }, 400);
  const q = parsed.value;

  try {
    const db = createAdminClient();
    const { data: dev } = await db.from('wa_devices').select('workspace_id').eq('active', true).limit(1).maybeSingle();
    if (!dev) return reply({ error: 'no_device', message: 'No WhatsApp device is connected in the ERP.' }, 503);
    const ws: string = dev.workspace_id;

    const id = { source: q.source, store: q.store, workspace: q.workspace };
    const key = storeKeyOf(id);
    const label = storeLabel(id);
    const weekFrom = q.week || lastFullWeek(jakartaDate()).from;

    // (Re)build this store's report from the latest numbers, unless it was already sent (a sent report is never rewritten).
    const find = () => db.from('wa_outbox').select('id, status, group_id, client_name, message, period_from, period_to, sent_at, detail').eq('workspace_id', ws).eq('kind', 'client-weekly').eq('store_label', label).eq('period_from', weekFrom).maybeSingle();
    let { data: row } = await find();
    if (!row || row.status === 'draft' || row.status === 'failed') {
      const prep = await prepareClientWeekly(ws, { onlyKey: key, week: weekFrom, refresh: true });
      ({ data: row } = await find());
      if (!row) return reply({ error: 'no_data', message: `There are no numbers for ${label} in the week of ${weekFrom} yet. Upload the weekly files first.`, problems: prep.errors }, 404);
    }

    let groupName: string | null = null;
    if (row.group_id) {
      const { data: g } = await db.from('wa_groups').select('name, wa_id, is_group').eq('id', row.group_id).maybeSingle();
      groupName = g ? (g.name || `Group ···${String(g.wa_id).slice(-6)}`) : null;
    }
    const info = {
      store: q.store, label, client: row.client_name, week: { from: row.period_from, to: row.period_to }, group: groupName, status: row.status,
      caption: row.message, imageUrl: signedWeeklyImageUrl(row.id),
    };
    if (q.action === 'preview') return reply({ ok: true, ...info });

    if (!row.group_id || !groupName) return reply({ error: 'no_group', message: 'This client has no WhatsApp group linked yet. Link it in the ERP (Optimizing > Clients).', ...info }, 409);
    if (row.status === 'sent' && !q.resend) return reply({ error: 'already_sent', message: 'This weekly report was already sent to the group.', sentAt: row.sent_at, ...info }, 409);

    const r = await sendOutboxItem(ws, null, row.id, { resend: q.resend });
    if (q.sentBy) await db.from('wa_outbox').update({ detail: `${r.detail} (sent from the app by ${q.sentBy})` }).eq('id', row.id);
    const { data: after } = await find();
    return reply(r.ok ? { ok: true, sent: true, detail: r.detail, ...info, status: after?.status || 'sent' } : { error: 'send_failed', message: r.detail, ...info, status: after?.status || row.status }, r.ok ? 200 : 502);
  } catch (err: any) {
    console.error('client-weekly api failed', err);
    return reply({ error: 'server_error', message: err?.message || 'Could not build the report.' }, 500);
  }
}
