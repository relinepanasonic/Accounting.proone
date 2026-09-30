import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { submitGoal } from '@/lib/ai/office-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const brief = typeof body?.brief === 'string' ? body.brief.trim() : '';
  if (brief.length < 5) return NextResponse.json({ error: 'Write a brief for the boss first.' }, { status: 400 });
  if (brief.length > 8000) return NextResponse.json({ error: 'The brief is too long (max 8,000 characters).' }, { status: 400 });

  try {
    const id = await submitGoal(access.supabase, access.workspaceId, access.userId, brief, Boolean(body?.deepThink));
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not save the brief.' }, { status: 500 });
  }
}
