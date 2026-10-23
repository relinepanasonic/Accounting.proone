import { NextResponse } from 'next/server';
import { authorizeErpApi } from '@/lib/api/erp-report';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { validDocSignature } from '@/lib/reports/signed-url';
import { loadInvoicePdfData } from '@/lib/invoices/invoice-pdf-data';
import { renderInvoicePdf } from '@/lib/invoices/invoice-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/v1/erp/drive-file?key=invoice:<id> | faktur:<id> | bukti:<id>: the file itself (the invoice as a PDF, or the uploaded tax document).
 * Bearer key, or the short-lived signed link from drive-sync (&exp=...&sig=...).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = String(url.searchParams.get('key') || '');
  if (!validDocSignature(key, url.searchParams.get('exp'), url.searchParams.get('sig')) && !authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try {
    const [kind, id] = key.split(':');
    const db = createAdminClient();
    if (kind === 'invoice' && id) {
      const data = await loadInvoicePdfData(db, id);
      if (!data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      const pdf = await renderInvoicePdf(data);
      return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${data.fileName}"`, 'Cache-Control': 'no-store' } });
    }
    if ((kind === 'faktur' || kind === 'bukti') && id) {
      const col = kind === 'faktur' ? 'faktur_pajak_url' : 'bukti_potong_url';
      const { data } = await db.from('invoices').select(col).eq('id', id).maybeSingle();
      const value = String((data as any)?.[col] || '');
      if (!value) return NextResponse.json({ error: 'No document' }, { status: 404 });
      const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(value);
      if (m) return new NextResponse(new Uint8Array(Buffer.from(m[2], 'base64')), { headers: { 'Content-Type': m[1], 'Cache-Control': 'no-store' } });
      if (/^https?:\/\//.test(value)) {
        const res = await fetch(value);
        return new NextResponse(new Uint8Array(await res.arrayBuffer()), { headers: { 'Content-Type': res.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' } });
      }
    }
    return NextResponse.json({ error: 'Unknown document' }, { status: 400 });
  } catch (err: any) {
    console.error('drive file failed', err);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
