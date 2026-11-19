import { createAdminClient } from '@/lib/api/supabase-admin';
import { phoneTail } from './channel';
import type { Candidate } from './staff-confirm-rules';

/**
 * A question Fefe asked a team member ("Apakah ini sama dengan client kita?") and is waiting to have answered. The original message is kept, so the answer
 * lets her carry on with exactly what was asked. Valid for 30 minutes; a new "Hi Fefe ..." message drops it.
 */
export interface Pending { id: string; body: string; kind: string; candidates: Candidate[] }
const VALID_MS = 30 * 60000;

export async function savePending(ws: string, waId: string, kind: 'meeting' | 'lead', body: string, candidates: Candidate[]): Promise<void> {
  const db = createAdminClient();
  const tail = phoneTail(waId);
  await db.from('staff_pending').delete().eq('workspace_id', ws).eq('phone_tail', tail);        // one question at a time per person
  const { error } = await db.from('staff_pending').insert({ workspace_id: ws, phone_tail: tail, kind, body: body.slice(0, 4000), candidates, expires_at: new Date(Date.now() + VALID_MS).toISOString() });
  if (error) console.error('save pending failed', error.message);
}

export async function readPending(ws: string, waId: string): Promise<Pending | null> {
  const { data } = await createAdminClient().from('staff_pending').select('id, body, kind, candidates').eq('workspace_id', ws).eq('phone_tail', phoneTail(waId)).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ? { id: (data as any).id, body: String((data as any).body || ''), kind: String((data as any).kind || ''), candidates: ((data as any).candidates || []) as Candidate[] } : null;
}

export async function clearPending(id: string): Promise<void> {
  await createAdminClient().from('staff_pending').delete().eq('id', id);
}
