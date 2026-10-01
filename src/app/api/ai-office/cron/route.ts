import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { runDueSchedules } from '@/lib/ai/mission';
import { tickOffice } from '@/lib/ai/office-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Called by Vercel Cron (see vercel.json). Starts calendar jobs that are due and works the office queue
 * for up to ~4 minutes. Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: rows, error } = await db.from('ai_schedules').select('workspace_id').eq('enabled', true);
  if (error) return NextResponse.json({ ok: true, note: 'No schedules table yet.' });

  const workspaces = Array.from(new Set((rows || []).map((r: any) => r.workspace_id as string)));
  const started: Record<string, number> = {};
  for (const ws of workspaces) started[ws] = await runDueSchedules(db, ws, null);

  // Work the queue of every workspace that has open work, until done or time is nearly up.
  const deadline = Date.now() + 240_000;
  const open = new Set(workspaces.filter((ws) => started[ws] > 0));
  while (open.size > 0 && Date.now() < deadline) {
    for (const ws of Array.from(open)) {
      const { active } = await tickOffice(db, ws);
      if (!active) open.delete(ws);
      if (Date.now() >= deadline) break;
    }
  }

  return NextResponse.json({ ok: true, started, unfinished: Array.from(open) });
}
