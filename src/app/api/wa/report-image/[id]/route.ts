import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waAccess } from '@/lib/wa/queries';
import { renderWeeklyJpeg } from '@/lib/wa/report-image';
import type { WeeklyPayload } from '@/lib/wa/weekly';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/wa/report-image/<weekly report id>: the weekly report image that was (or will be) sent, drawn from the numbers saved with it.
 * For finance roles signed in to the ERP (the status table shows it when you click a check).
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await waAccess();
  if (!access) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const { id } = await ctx.params;
  const { data: row } = await createAdminClient().from('wa_outbox').select('payload').eq('id', id).eq('workspace_id', access.activeWorkspaceId).eq('kind', 'client-weekly').maybeSingle();
  const p = row?.payload as WeeklyPayload | null | undefined;
  if (!p || !p.cur) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  try {
    const jpg = await renderWeeklyJpeg(p);
    return new NextResponse(Buffer.from(jpg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    console.error('wa report image failed', e);
    return new NextResponse(null, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
