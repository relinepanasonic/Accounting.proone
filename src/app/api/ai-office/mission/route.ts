import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { getMissionState, runDueSchedules } from '@/lib/ai/mission';

export const dynamic = 'force-dynamic';

/** Everything Mission Control shows. Opening or refreshing it also starts any calendar job that is due. */
export async function GET() {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const started = await runDueSchedules(access.supabase, access.workspaceId, access.userId);
  return NextResponse.json({ ...(await getMissionState(access.supabase, access.workspaceId)), startedSchedules: started });
}
