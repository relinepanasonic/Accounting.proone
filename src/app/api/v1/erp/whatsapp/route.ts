import { NextResponse } from 'next/server';
import { authorizeErpApi } from '@/lib/api/erp-report';
import { buildWhatsAppReport } from '@/lib/reports/whatsapp-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/v1/erp/whatsapp: the WhatsApp report for Nico, Herlan and Lucy (Make.com sends it at 09:00).
 *  Tuesday to Saturday: Daily report of yesterday. Monday: Weekly report (Monthly on the first Monday of a month). Sunday: nothing.
 * Header: Authorization: Bearer <ERP_API_KEY>. Optional ?date=YYYY-MM-DD acts as "today" (to test a day).
 * Response: { send, kind, date, text }. Make must only send when send is true.
 */
export async function GET(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try {
    const date = new URL(request.url).searchParams.get('date') || undefined;
    const res = await buildWhatsAppReport(date);
    return NextResponse.json({ ...res, chars: res.text.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('whatsapp report failed', err);
    return NextResponse.json({ error: 'Report failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
