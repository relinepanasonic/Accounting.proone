import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { tickOffice } from '@/lib/ai/office-engine';

export const dynamic = 'force-dynamic';
// One step can include a Claude planning or QC call.
export const maxDuration = 300;

export async function POST() {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await tickOffice(access.supabase, access.workspaceId));
}
