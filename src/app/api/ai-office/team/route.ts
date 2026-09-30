import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { activateTeam } from '@/lib/ai/office-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  try {
    const id = await activateTeam(access.supabase, access.workspaceId, slug);
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not activate the team.' }, { status: 400 });
  }
}
