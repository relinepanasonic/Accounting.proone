import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { getOfficeState } from '@/lib/ai/office-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await getOfficeState(access.supabase, access.workspaceId));
}
