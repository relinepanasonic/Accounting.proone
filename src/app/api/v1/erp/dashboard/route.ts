import { NextResponse } from 'next/server';
import { authorizeErpApi, loadErpDashboards, dashboardNumbers } from '@/lib/api/erp-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/v1/erp/dashboard?year=2026&month=10&company=PLIG
 * The dashboard numbers per company (revenue, MRR, overhead, coverage, cash, A/R...). year defaults to this year,
 * month (1-12) to all months, company (code: PLIG, ProOne, NW, DOA) to every company plus the combined total.
 * Header: Authorization: Bearer <ERP_API_KEY>. Read-only.
 */
export async function GET(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const p = new URL(request.url).searchParams;
  const year = Number(p.get('year')) || new Date().getFullYear();
  const m = Number(p.get('month'));
  if (year < 2000 || year > 2100 || (p.get('month') && !(m >= 1 && m <= 12))) {
    return NextResponse.json({ error: 'invalid year or month' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const { companies, total } = await loadErpDashboards({ year, month: p.get('month') ? m - 1 : null, company: (p.get('company') || '').slice(0, 40) });
    return NextResponse.json({
      generatedAt: new Date().toISOString(), year, month: p.get('month') ? m : null,
      total: total ? dashboardNumbers(total) : null,
      companies: companies.map(({ telemetry: _t, ...c }) => c),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('erp dashboard failed', err);
    return NextResponse.json({ error: 'Dashboard failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
