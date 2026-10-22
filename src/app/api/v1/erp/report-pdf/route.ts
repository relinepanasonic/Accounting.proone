import { NextResponse } from 'next/server';
import { authorizeErpApi } from '@/lib/api/erp-report';
import { gatherReportData, planReport, resolveToday } from '@/lib/reports/whatsapp-report';
import { REPORT_COMPANIES, reportFiles, type ReportCompany } from '@/lib/reports/report-files';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { renderReportPdf } from '@/lib/reports/pdf-report';
import { validReportSignature } from '@/lib/reports/signed-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/v1/erp/report-pdf?company=ProOne&date=YYYY-MM-DD: the weekly / monthly report of one company as a PDF with the charts.
 * Header: Authorization: Bearer <ERP_API_KEY> (or a signed link: &exp=...&sig=..., valid 30 minutes). Optional ?date acts as "today" (the Monday the report is made).
 * 204 when that day has no weekly / monthly report.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Bearer key, or a short-lived signed link for this exact company and date (Make.com's "Get a file" cannot send a header).
  const signedOk = validReportSignature(String(url.searchParams.get('company') || ''), String(url.searchParams.get('date') || ''), url.searchParams.get('exp'), url.searchParams.get('sig'));
  if (!signedOk && !authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try {
    const company = (REPORT_COMPANIES as readonly string[]).find((c) => c.toLowerCase() === String(url.searchParams.get('company') || '').toLowerCase()) as ReportCompany | undefined;
    if (!company) return NextResponse.json({ error: `company must be one of ${REPORT_COMPANIES.join(', ')}` }, { status: 400 });

    // The plan and the file name only need the date: open a stored copy without counting the numbers again.
    const today = resolveToday(url.searchParams.get('date') || undefined);
    const plan = planReport(today);
    if (plan.kind !== 'weekly' && plan.kind !== 'monthly') return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

    const file = reportFiles(plan, today).find((f) => f.company === company)!;
    const headers = { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${file.name}"`, 'Cache-Control': 'no-store' };

    // Every report is kept: the first request makes it and stores it (private bucket "reports", <year>/<mm Month>/<file>); later requests
    // open the stored copy, so a link still shows the numbers of that Monday. Bearer + ?fresh=1 makes it again.
    const db = createAdminClient();
    const path = `${file.folderPath.replace(' / ', '/')}/${file.name}`;
    const fresh = url.searchParams.get('fresh') === '1' && !signedOk;
    if (!fresh) {
      const { data: stored } = await db.storage.from('reports').download(path);
      if (stored) return new NextResponse(new Uint8Array(await stored.arrayBuffer()), { headers });
    }
    const data = await gatherReportData(today);
    if (!data) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    const pdf = await renderReportPdf(data, company);
    const up = await db.storage.from('reports').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (up.error && /bucket/i.test(up.error.message)) {
      await db.storage.createBucket('reports', { public: false });
      await db.storage.from('reports').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    }
    return new NextResponse(new Uint8Array(pdf), { headers });
  } catch (err: any) {
    console.error('report pdf failed', err);
    return NextResponse.json({ error: err?.message || 'PDF failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
