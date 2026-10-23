import { NextResponse } from 'next/server';
import { authorizeErpApi } from '@/lib/api/erp-report';
import { pendingDriveItems, confirmDriveItem, syncedInvoiceFiles } from '@/lib/drive/sync';
import { signedDocUrl } from '@/lib/reports/signed-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

/**
 * GET /api/v1/erp/drive-sync?limit=20: the documents that still have to be copied to Google Drive (invoice PDFs, Faktur Pajak, Bukti Potong),
 * each with a 30 minute download link. Header: Authorization: Bearer <ERP_API_KEY>. Make.com uploads them and calls POST to confirm each one.
 */
export async function GET(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: noStore });
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('mode') === 'synced') {
      const files = await syncedInvoiceFiles(Math.max(1, Number(url.searchParams.get('limit')) || 1000));
      return NextResponse.json({ count: files.length, items: files }, { headers: noStore });
    }
    const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const { items, remaining } = await pendingDriveItems(limit);
    return NextResponse.json({ count: items.length, remaining, items: items.map((i) => ({ ...i, url: signedDocUrl(url.origin, i.key) })) }, { headers: noStore });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not list the documents.' }, { status: 500, headers: noStore });
  }
}

/** POST { key, kind, name, fileId }: this document is now in Drive. */
export async function POST(request: Request) {
  if (!authorizeErpApi(request)) return new NextResponse(null, { status: 401, headers: noStore });
  try {
    const b = await request.json();
    if (!b?.key || !b?.fileId) return NextResponse.json({ error: 'key and fileId are required' }, { status: 400, headers: noStore });
    await confirmDriveItem(String(b.key), String(b.kind || ''), String(b.name || ''), String(b.fileId));
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not confirm.' }, { status: 500, headers: noStore });
  }
}
