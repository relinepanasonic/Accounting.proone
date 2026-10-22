import { NextResponse } from 'next/server';
import { runControlTeam } from '@/lib/ai/control-team';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel Cron, 08:00 Jakarta (see vercel.json): the Optimize Control team writes today's reports and Prof's WhatsApp message. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const res = await runControlTeam();
  return NextResponse.json({ ok: true, today: res.today, reports: res.reports.length, errors: res.errors });
}
