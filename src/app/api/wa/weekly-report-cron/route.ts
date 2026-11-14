import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendPerformance } from '@/lib/wa/performance';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Called by Vercel Cron (see vercel.json) every Monday at 08:00 Jakarta time (01:00 UTC): the weekly report (monthly on the first Monday of a
 * month) to the BOD. The daily report goes at 19:00 from /api/wa/performance-cron.
 * Sends only for companies where WA Control > Founder > "Send automatically" is ON (default OFF), and never twice in a day.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createAdminClient();
  const { data } = await db.from('wa_settings').select('workspace_id').eq('auto_send', true);
  const results: Record<string, unknown> = {};
  for (const row of data || []) {
    try { results[row.workspace_id] = await sendPerformance(row.workspace_id, { trigger: 'cron', slot: 'morning' }); }
    catch (e: any) { results[row.workspace_id] = { sent: false, reason: e?.message || String(e) }; }
  }
  return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
}
