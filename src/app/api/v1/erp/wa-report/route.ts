import { NextResponse } from 'next/server';
import { authorizeErpApi } from '@/lib/api/erp-report';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { jakartaDate, whatsappText } from '@/lib/wa/report-text';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/erp/wa-report: the latest WhatsApp chat report, ready for Make.com to send.
 * Header: Authorization: Bearer <ERP_API_KEY>. Optional ?date=YYYY-MM-DD (default: today, Jakarta) and ?workspace=<id>
 * (default: the company that has a connected device).
 * Response: { send, date, text, digest, reports: [{ chat, messages, summary }], followUps: [...] }. Send only when send is true.
 */
export async function GET(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : jakartaDate();
    const db = createAdminClient();
    let ws = url.searchParams.get('workspace');
    if (!ws) {
      const { data } = await db.from('wa_devices').select('workspace_id').eq('active', true).limit(1).maybeSingle();
      ws = data?.workspace_id || null;
    }
    if (!ws) return NextResponse.json({ send: false, date, reason: 'no device' }, { headers: { 'Cache-Control': 'no-store' } });

    const [{ data: reps }, { data: groups }, { data: items }] = await Promise.all([
      db.from('wa_reports').select('group_id, summary, message_count').eq('workspace_id', ws).eq('report_date', date),
      db.from('wa_groups').select('id, name, wa_id, is_group').eq('workspace_id', ws),
      db.from('wa_action_items').select('title, detail, owner_phone, due_date, group_id').eq('workspace_id', ws).eq('status', 'open').order('created_at', { ascending: false }).limit(30),
    ]);
    const nameOf = new Map((groups || []).map((g: any) => [g.id, g.name || (g.is_group ? `Group ${String(g.wa_id).slice(-6)}` : `+${g.wa_id}`)]));
    const digest = (reps || []).find((r: any) => !r.group_id)?.summary || null;
    const perChat = (reps || []).filter((r: any) => r.group_id).map((r: any) => ({ name: nameOf.get(r.group_id) || 'Chat', count: r.message_count as number, summary: r.summary as string }));
    const send = !!digest || perChat.length > 0;
    return NextResponse.json({
      send, date, digest,
      reports: perChat.map((r) => ({ chat: r.name, messages: r.count, summary: r.summary })),
      followUps: (items || []).map((i: any) => ({ title: i.title, detail: i.detail, ownerPhone: i.owner_phone, dueDate: i.due_date, chat: nameOf.get(i.group_id) || null })),
      text: send ? whatsappText(date, digest, perChat) : '',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('wa report api failed', err);
    return NextResponse.json({ error: 'Report failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
