import { NextResponse } from 'next/server';
import { authorizeErpApi } from '@/lib/api/erp-report';
import { runControlTeam } from '@/lib/ai/control-team';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/v1/erp/whatsapp: today's WhatsApp message of the AI team (Prof), for Make.com to send to Nico, Herlan and Lucy.
 * Normally ready since 08:00 (cron); if not, the team runs now (can take up to a minute).
 * Header: Authorization: Bearer <ERP_API_KEY>. Response: { date, text, chars, errors }.
 */
export async function GET(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try {
    const res = await runControlTeam();
    if (!res.message) return NextResponse.json({ error: 'No message: ' + (res.errors.join('; ') || 'unknown'), errors: res.errors }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ date: res.today, text: res.message, chars: res.message.length, errors: res.errors }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('whatsapp message failed', err);
    return NextResponse.json({ error: 'Message failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
