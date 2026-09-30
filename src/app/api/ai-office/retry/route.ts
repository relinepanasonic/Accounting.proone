import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { retryGoal } from '@/lib/ai/office-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const goalId = typeof body?.goalId === 'string' ? body.goalId : '';
  try {
    await retryGoal(access.supabase, access.workspaceId, goalId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not retry.' }, { status: 400 });
  }
}
