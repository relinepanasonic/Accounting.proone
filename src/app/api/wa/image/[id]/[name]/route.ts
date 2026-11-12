import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { renderWeeklyJpeg } from '@/lib/wa/report-image';
import { validWeeklyImageSignature } from '@/lib/wa/signed';
import type { WeeklyPayload } from '@/lib/wa/weekly';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/wa/image/<draft id>/Weekly-Report.jpg?exp=...&sig=...: the weekly report image of one draft, for anyone holding the signed link
 * (the preview Dashboard Prof and Reline show to the admin before sending; valid for an hour).
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string; name: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  if (!validWeeklyImageSignature(id, url.searchParams.get('exp'), url.searchParams.get('sig'))) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const { data: row } = await createAdminClient().from('wa_outbox').select('payload').eq('id', id).eq('kind', 'client-weekly').maybeSingle();
  const p = row?.payload as WeeklyPayload | null | undefined;
  if (!p || !p.cur) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  try {
    const jpg = await renderWeeklyJpeg(p);
    return new NextResponse(Buffer.from(jpg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    console.error('wa signed image failed', e);
    return new NextResponse(null, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
