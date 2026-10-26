import { NextResponse } from 'next/server';
import { runControlTeam } from '@/lib/ai/control-team';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { syncAssetSchedules } from '@/lib/assets/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel Cron, 08:00 Jakarta (see vercel.json): the Optimize Control team writes today's reports and Prof's WhatsApp message. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Same daily job: the Schedule Expense payments of the assets that fell due are posted (the Hobby plan has no room for a third cron).
  let assets: { posted: number; error?: string } = { posted: 0 };
  try { const a = await syncAssetSchedules(createAdminClient()); assets = { posted: a.posted, error: a.error }; } catch (e: any) { assets = { posted: 0, error: e?.message }; }
  const res = await runControlTeam();
  return NextResponse.json({ ok: true, today: res.today, reports: res.reports.length, errors: res.errors, assets });
}
