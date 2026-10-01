import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';

export const dynamic = 'force-dynamic';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const idOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** The agent (if any) must belong to the chosen team. */
async function checkAgent(db: any, workspaceId: string, teamId: string | null, agentId: string | null) {
  if (!agentId) return true;
  const { data } = await db.from('ai_agents').select('team_id').eq('id', agentId).eq('workspace_id', workspaceId).maybeSingle();
  return Boolean(data) && (data.team_id ?? null) === teamId;
}

export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const title = str(body?.title, 120);
  const content = str(body?.content, 4000);
  const teamId = idOrNull(body?.teamId);
  const agentId = idOrNull(body?.agentId);
  if (!title || !content) return NextResponse.json({ error: 'Write a title and the note.' }, { status: 400 });
  if (!(await checkAgent(access.supabase, access.workspaceId, teamId, agentId))) return NextResponse.json({ error: 'That agent is not in this team.' }, { status: 400 });

  const { error } = await access.supabase.from('ai_memories').insert({
    workspace_id: access.workspaceId, team_id: teamId, agent_id: agentId, title, content, pinned: Boolean(body?.pinned), created_by: access.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = idOrNull(body?.id);
  if (!id) return NextResponse.json({ error: 'Missing note.' }, { status: 400 });

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) fields.title = str(body.title, 120);
  if (body.content !== undefined) fields.content = str(body.content, 4000);
  if (body.pinned !== undefined) fields.pinned = Boolean(body.pinned);
  if (body.teamId !== undefined || body.agentId !== undefined) {
    const teamId = idOrNull(body.teamId);
    const agentId = idOrNull(body.agentId);
    if (!(await checkAgent(access.supabase, access.workspaceId, teamId, agentId))) return NextResponse.json({ error: 'That agent is not in this team.' }, { status: 400 });
    fields.team_id = teamId;
    fields.agent_id = agentId;
  }
  if (fields.title === '' || fields.content === '') return NextResponse.json({ error: 'Title and note cannot be empty.' }, { status: 400 });

  const { error } = await access.supabase.from('ai_memories').update(fields).eq('id', id).eq('workspace_id', access.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing note.' }, { status: 400 });
  const { error } = await access.supabase.from('ai_memories').delete().eq('id', id).eq('workspace_id', access.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
