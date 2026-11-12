'use server';

import { revalidatePath } from 'next/cache';
import { waAccess } from '@/lib/wa/queries';
import { reportIdOf, sendStoreWeek } from '@/lib/wa/upload-trigger';

/** Admin > Performance: send the weekly report of one store now (the 6th step of the checklist), without waiting for the automatic trigger. */
export async function sendStoreWeeklyReport(input: { project: 'profesor' | 'reline' | 'alpha' | 'light'; store: string; workspace: string; monday: string; resend?: boolean }): Promise<{ ok: boolean; detail: string }> {
  const ctx = await waAccess();
  if (!ctx || !ctx.userId) return { ok: false, detail: 'Not allowed.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.monday)) return { ok: false, detail: 'Bad week.' };
  try {
    const r = await sendStoreWeek(ctx.activeWorkspaceId, ctx.userId, reportIdOf({ project: input.project, store: String(input.store).slice(0, 200), workspace: String(input.workspace || '').slice(0, 100) }), input.monday, { resend: input.resend });
    revalidatePath('/productivity/admin');
    return { ok: r.ok, detail: r.detail };
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Could not send.' };
  }
}
