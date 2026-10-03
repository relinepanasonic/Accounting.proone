import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { createTeamFromBlueprint, proposeBlueprint } from '@/lib/ai/blueprint';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Preview: turns a finished Scout Team report into a team definition. Saves nothing. */
export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const goalId = typeof body?.goalId === 'string' ? body.goalId : '';
  const { data: goal } = await access.supabase.from('ai_tasks').select('instructions, result, status, kind').eq('id', goalId).eq('workspace_id', access.workspaceId).maybeSingle();
  if (!goal || goal.kind !== 'goal' || !goal.result) return NextResponse.json({ error: 'That brief has no finished report yet.' }, { status: 400 });
  try {
    return NextResponse.json({ blueprint: await proposeBlueprint(goal.instructions, goal.result) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not read the recommendation.' }, { status: 500 });
  }
}

/** Approve: creates the team (with its hexagon island, agents, job desks and starter tasks). */
export async function PUT(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  try {
    const id = await createTeamFromBlueprint(access.supabase, access.workspaceId, body?.blueprint);
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not create the team.' }, { status: 400 });
  }
}
