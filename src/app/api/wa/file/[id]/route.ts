import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { renderWeeklyPdf } from '@/lib/wa/weekly-pdf';
import { weeklyFileName, type WeeklyPayload } from '@/lib/wa/weekly';
import { validWeeklyPdfSignature } from '@/lib/wa/signed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/wa/file/<draft id>?exp=...&sig=...: the weekly report PDF of one client summary draft.
 * Only a signed link opens it (the signature covers the draft and its expiry); Fonnte downloads it from here and sends it on WhatsApp.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  if (!validWeeklyPdfSignature(id, url.searchParams.get('exp'), url.searchParams.get('sig'))) {
    return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const { data: row } = await createAdminClient().from('wa_outbox').select('payload').eq('id', id).eq('kind', 'client-weekly').maybeSingle();
    const p = row?.payload as WeeklyPayload | null | undefined;
    if (!p || !p.cur) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const pdf = await renderWeeklyPdf(p);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${weeklyFileName(p.store, p.from, p.to).replace(/[^\x20-\x7E]/g, '')}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('wa weekly pdf failed', err);
    return new NextResponse(null, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
