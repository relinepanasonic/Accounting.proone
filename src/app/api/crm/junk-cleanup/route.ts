import { NextResponse } from 'next/server';
import { cleanupArchivedJunk } from '@/lib/chat/junk-leads';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Called by Vercel Cron (see vercel.json) every day at 23:30 Jakarta time (16:30 UTC); it only does anything on the LAST day of the month: deletes the leads
 * archived as "not a lead" (and their bare prospect clients). "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await cleanupArchivedJunk();
  return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
}
