import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export const dynamic = 'force-dynamic';

/** A visit photo (?id=...&k=client|receipt). Only for who logged the visit, finance roles, and owners of that workspace. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const kind = url.searchParams.get('k') === 'receipt' ? 'receipt_photo' : 'client_photo';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Bad request', { status: 400 });

  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || ctx.role === 'none') return new NextResponse('Unauthorized', { status: 401 });

  const { data } = await createAdminClient().from('lead_visits').select(`salesman_id, workspace_id, ${kind}`).eq('id', id).maybeSingle();
  if (!data || data.workspace_id !== ctx.activeWorkspaceId) return new NextResponse('Not found', { status: 404 });
  const allowed = data.salesman_id === ctx.userId || ['accounting', 'admin', 'superadmin', 'founder'].includes(ctx.role);
  if (!allowed) return new NextResponse('Forbidden', { status: 403 });

  const dataUrl = (data as any)[kind] as string | null;
  const m = dataUrl && /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl);
  if (!m) return new NextResponse('No photo', { status: 404 });
  return new NextResponse(Buffer.from(m[1], 'base64'), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
}
