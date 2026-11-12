import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waAccess } from '@/lib/wa/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/wa/sent-image/<send id>: the image (or PDF) of an advertiser session report that Oli sent, as it was sent.
 * For finance roles signed in to the ERP. 404 when no copy was kept (reports sent before copies were kept).
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await waAccess();
  if (!access) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const { id } = await ctx.params;
  const db = createAdminClient();
  const { data: row } = await db.from('wa_sends').select('file_path').eq('id', id).eq('workspace_id', access.activeWorkspaceId).eq('kind', 'session').maybeSingle();
  if (!row?.file_path) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const { data: file } = await db.storage.from('wa-files').download(row.file_path);
  if (!file) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const pdf = row.file_path.endsWith('.pdf');
  return new NextResponse(new Uint8Array(await file.arrayBuffer()), { headers: { 'Content-Type': pdf ? 'application/pdf' : 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
}
