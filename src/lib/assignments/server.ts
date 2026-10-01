import type { AssignmentJob } from '@/lib/assignments/jobs';

const isMissingColumn = (error: any) => error?.code === '42703' || error?.code === 'PGRST204' || /\bjob\b/.test(error?.message || '');

/** Ids of the clients a person holds for one job. Works before the job column exists (everything counts as advertising). */
export async function assignedClientIds(db: any, workspaceId: string, userId: string | undefined, job: AssignmentJob): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await db.from('client_assignments').select('client_id').eq('workspace_id', workspaceId).eq('user_id', userId).eq('job', job);
  if (!error) return new Set((data || []).map((a: any) => a.client_id));

  if (isMissingColumn(error)) {
    if (job !== 'advertising') return new Set();
    const legacy = await db.from('client_assignments').select('client_id').eq('workspace_id', workspaceId).eq('user_id', userId);
    return new Set((legacy.data || []).map((a: any) => a.client_id));
  }
  return new Set();
}
