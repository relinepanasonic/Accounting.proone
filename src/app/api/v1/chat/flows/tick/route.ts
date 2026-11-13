import { NextResponse } from 'next/server';
import { runClock } from '@/lib/chat/clock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/v1/chat/flows/tick: the clock for Wait boxes, broadcasts and meeting reminders. The database calls it once a minute while a Wait is due (pg_cron, see the flow_v2 migration),
 * with a key that only the database holds. Anything else gets 401.
 */
export async function POST(req: Request) {
  const r = await runClock(req.headers.get('x-flow-tick'));
  return NextResponse.json(r.ok ? r : { error: r.error }, { status: r.ok ? 200 : r.status, headers: { 'Cache-Control': 'no-store' } });
}
