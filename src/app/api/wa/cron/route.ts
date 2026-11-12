import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { generateReports } from '@/lib/wa/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Called by Vercel Cron (see vercel.json) at 18:00 Jakarta time. Writes the daily WhatsApp reports for every company
 * that has a connected device. Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createAdminClient();
  const { data } = await db.from('wa_devices').select('workspace_id').eq('active', true);
  const workspaces = Array.from(new Set((data || []).map((d: any) => d.workspace_id as string)));
  const results: Record<string, unknown> = {};
  for (const ws of workspaces) {
    try { results[ws] = await generateReports(ws); } catch (e: any) { results[ws] = { error: e?.message || String(e) }; }
  }
  return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
}
