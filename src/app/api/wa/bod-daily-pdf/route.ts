import { NextResponse } from 'next/server';
import { waFounderAccess } from '@/lib/wa/queries';
import { loadBodDaily } from '@/lib/wa/bod-daily';
import { renderBodDailyPdf } from '@/lib/wa/bod-daily-pdf';
import { resolveToday } from '@/lib/reports/whatsapp-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/wa/bod-daily-pdf?date=YYYY-MM-DD: the daily BOD PDF as it is sent at 19:00 on that day, about that day (default today). Founder and superadmin only (the signed-in session). */
export async function GET(request: Request) {
  const ctx = await waFounderAccess();
  if (!ctx) return new NextResponse(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  try {
    const today = resolveToday(new URL(request.url).searchParams.get('date') || undefined);
    const data = await loadBodDaily(today);
    if (!data) return new NextResponse('There is no daily report on this day (Saturday and Sunday have none).', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const pdf = await renderBodDailyPdf(data);
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Daily-BOD-Report-${data.reportDay}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('bod daily pdf failed', e);
    return new NextResponse(e?.message || 'PDF failed', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
