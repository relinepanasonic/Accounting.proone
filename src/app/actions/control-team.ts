'use server';

import { getOfficeAccess } from '@/lib/ai/office-auth';
import { runControlTeam } from '@/lib/ai/control-team';

/** Founder / superadmin: run the Optimize Control team now (writes today's reports again). */
export async function runControlNow(): Promise<{ success: boolean; message?: string; errors?: string[]; error?: string }> {
  const access = await getOfficeAccess();
  if (!access) return { success: false, error: 'Only the Founder and Superadmins can run the AI team.' };
  try {
    const res = await runControlTeam({ force: true });
    return { success: true, message: res.message, errors: res.errors };
  } catch (e: any) {
    return { success: false, error: e?.message || 'The AI team could not run.' };
  }
}
