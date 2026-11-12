import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { sendWhatsApp } from '@/lib/wa/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;          // Fonnte takes files up to 4 MB
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * POST /api/wa/session-send (multipart): an advertiser's session report goes to the client's WhatsApp group, sent by Oli's number.
 * Fields: clientId, reportDate (YYYY-MM-DD), session, storeLabel, message (the report text), file (the report PDF built on screen), force ("1" to send again).
 * Who: finance roles, or an advertiser assigned to that client. The group is the one linked to the client (Client Contact).
 * The PDF is attached only when "send PDFs as files" is ON (Fonnte Super package); otherwise the text goes alone.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || !ctx.activeWorkspaceId || !(FINANCE_ROLES.includes(ctx.role) || ctx.role === 'advertiser')) return json({ error: 'Not allowed' }, 403);

  let fd: FormData;
  try { fd = await request.formData(); } catch { return json({ error: 'Bad request' }, 400); }
  const clientId = String(fd.get('clientId') || '');
  const reportDate = String(fd.get('reportDate') || '');
  const session = Number(fd.get('session'));
  const storeLabel = String(fd.get('storeLabel') || '').slice(0, 200);
  const message = String(fd.get('message') || '').trim().slice(0, 4000);
  const force = String(fd.get('force') || '') === '1';
  const file = fd.get('file');
  if (!UUID.test(clientId) || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !Number.isInteger(session) || session < 1 || session > 9 || !message) return json({ error: 'Incomplete report' }, 400);

  const db = createAdminClient();
  const ws = ctx.activeWorkspaceId;
  const { data: client } = await db.from('clients').select('id, name, wa_group_id').eq('id', clientId).eq('workspace_id', ws).maybeSingle();
  if (!client) return json({ error: 'Client not found' }, 404);

  if (ctx.role === 'advertiser') {
    const { data: mine } = await db.from('client_assignments').select('client_id').eq('client_id', clientId).eq('user_id', ctx.userId).eq('job', 'advertising').limit(1);
    if (!mine || mine.length === 0) return json({ error: 'This client is not assigned to you.' }, 403);
  }
  if (!client.wa_group_id) return json({ error: `No WhatsApp group is linked to ${client.name}. Link it in Client Contact (WhatsApp Group column).` }, 409);
  const { data: group } = await db.from('wa_groups').select('wa_id, is_group').eq('id', client.wa_group_id).eq('workspace_id', ws).maybeSingle();
  if (!group) return json({ error: 'The linked group no longer exists.' }, 409);
  const target = group.is_group ? `${group.wa_id}@g.us` : group.wa_id;

  // The same session report must not go to the client twice by a double click: ask again with force.
  const ref = [clientId, storeLabel, reportDate, session].join('|');
  if (!force) {
    const { data: recent } = await db.from('wa_sends').select('created_at').eq('workspace_id', ws).eq('kind', 'session').eq('ref', ref).eq('ok', true).gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()).limit(1);
    if (recent && recent.length) return json({ already: true, sentAt: recent[0].created_at, error: 'This session report was already sent to the group.' }, 409);
  }

  const { data: settings } = await db.from('wa_settings').select('send_files').eq('workspace_id', ws).maybeSingle();
  const isImage = file instanceof File && file.type === 'image/jpeg' && file.size > 0;
  const isPdf = file instanceof File && file.type === 'application/pdf' && file.size > 0;
  const attach = !!settings?.send_files && (isImage || isPdf);

  let fileArg: { data: Uint8Array; filename: string; contentType: string } | undefined;
  if (attach) {
    const pdf = file as File;   // the report as an image (preferred: it shows inline in the chat) or as a PDF
    if (pdf.size > MAX_BYTES) return json({ error: 'The file is over 4 MB (Fonnte limit). Switch off the screenshot in the report and try again.' }, 413);
    // The PDF that came from the screen is uploaded to Fonnte as a real file: nothing is stored on our side.
    fileArg = { data: new Uint8Array(await pdf.arrayBuffer()), filename: (pdf.name || (isImage ? 'Report.jpg' : 'Report.pdf')).replace(/[\\/:*?"<>|]/g, '').slice(0, 120), contentType: isImage ? 'image/jpeg' : 'application/pdf' };
  }

  const r = await sendWhatsApp([target], message, fileArg ? { file: fileArg } : {});
  const detail = `${attach ? (isImage ? 'Image' : 'PDF') : 'Text only'}: ${r.detail}`;
  const { data: logged } = await db.from('wa_sends').insert({ workspace_id: ws, kind: 'session', report_date: reportDate, trigger: 'manual', recipients: [target], ok: r.ok, detail, text: message, ref }).select('id').single();

  // Keep a copy of what was sent, so the status table can show it later (best effort: a failed copy never turns a sent report into an error).
  if (r.ok && attach && fileArg && logged?.id) {
    try {
      const path = `session/${ws}/${reportDate.slice(0, 7)}/${logged.id}.${isImage ? 'jpg' : 'pdf'}`;
      const up = await db.storage.from('wa-files').upload(path, fileArg.data, { contentType: fileArg.contentType, upsert: true });
      if (!up.error) await db.from('wa_sends').update({ file_path: path }).eq('id', logged.id);
    } catch { /* ignore */ }
  }
  return r.ok ? json({ ok: true, attached: attach, client: client.name, detail }) : json({ error: detail }, 502);
}
