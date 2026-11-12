import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { syncGroupsFor } from '@/lib/wa/group-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Called by Vercel Cron (see vercel.json) every day at 12:01 Jakarta time (05:01 UTC): asks Fonnte for the groups Oli is in and adds the
 * new ones (with their names). It only READS Fonnte's list. Re-reading the list from WhatsApp (which Fonnte warns can get a number banned
 * if overused) happens only when "group_sync_refresh" is on in wa_settings (off by default).
 * Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createAdminClient();
  const [{ data: devices }, { data: settings }] = await Promise.all([
    db.from('wa_devices').select('workspace_id').eq('active', true),
    db.from('wa_settings').select('workspace_id, group_sync_refresh'),
  ]);
  const refreshOf = new Map((settings || []).map((s: any) => [s.workspace_id as string, !!s.group_sync_refresh]));
  const results: Record<string, unknown> = {};
  for (const ws of Array.from(new Set((devices || []).map((d: any) => d.workspace_id as string)))) {
    try { results[ws] = await syncGroupsFor(ws, refreshOf.get(ws) === true); } catch (e: any) { results[ws] = { error: e?.message || String(e) }; }
  }
  return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
}
