import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendReadyWeeklyReports } from '@/lib/wa/upload-trigger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Sends the weekly report of every store whose 5 weekly files are all uploaded (Admin > Performance checklist). Vercel Cron runs it daily;
 * it can also be called more often from outside (Make.com) with the same header. "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 * Add ?dry=1 to only list what it would send.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const dry = new URL(request.url).searchParams.get('dry') === '1';
  const { data } = await createAdminClient().from('wa_devices').select('workspace_id').eq('active', true);
  const workspaces = Array.from(new Set((data || []).map((d: any) => d.workspace_id as string)));
  const results: Record<string, unknown> = {};
  for (const ws of workspaces) {
    try { results[ws] = await sendReadyWeeklyReports(ws, { dryRun: dry }); } catch (e: any) { results[ws] = { error: e?.message || String(e) }; }
  }
  return NextResponse.json({ ok: true, dry, results }, { headers: { 'Cache-Control': 'no-store' } });
}
