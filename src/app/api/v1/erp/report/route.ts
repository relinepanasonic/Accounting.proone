import { NextResponse } from 'next/server';
import { authorizeErpApi, buildErpReport } from '@/lib/api/erp-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/v1/erp/report: the morning report (numbers per company, overdue invoices, who did not upload) plus a ready-to-send `text`.
 * Header: Authorization: Bearer <ERP_API_KEY>. Read-only. Meant for Make.com / an AI agent.
 */
export async function GET(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try {
    return NextResponse.json(await buildErpReport(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('erp report failed', err);
    return NextResponse.json({ error: 'Report failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
