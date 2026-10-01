import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';

export const dynamic = 'force-dynamic';

/** Turn one agent on or off. A switched-off agent gets no new subtasks. */
export async function PATCH(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id || typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'Missing agent or setting.' }, { status: 400 });

  const { error } = await access.supabase.from('ai_agents').update({ enabled: body.enabled }).eq('id', id).eq('workspace_id', access.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
