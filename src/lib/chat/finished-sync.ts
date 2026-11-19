import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadClientRows } from '@/lib/sales/client-table';
import { memo } from './cache';
import { phaseOf, stageForPhase } from './finished-rules';

/**
 * Keeps the pipeline stage "Finished" in step with the ERP Clients page. An Active Client whose project ran out there (lifecycle Finished) moves to Finished;
 * a Finished client with a new running, scheduled or frozen project goes back to Active Client. A person who sets a client to Finished (or Active) on the
 * ERP Clients page moves the card the same way. Churn is never touched. Runs when the board loads, at most every 10 minutes. Never throws.
 */
async function run(ws: string): Promise<number> {
  const db = createAdminClient();
  const { data: deals } = await db.from('crm_deals').select('id, client_id, stage').eq('workspace_id', ws).in('stage', ['Deal', 'Finished']).limit(2000);
  const list = (deals || []) as Array<{ id: string; client_id: string | null; stage: string }>;
  if (!list.length) return 0;
  const rows = await loadClientRows(db as any, ws, { archived: 'all', includeAll: true, maskName: (n: string | null | undefined) => String(n || '') });
  const byClient = new Map<string, string[]>();
  for (const r of rows) byClient.set(r.clientId, [...(byClient.get(r.clientId) || []), r.lifecycle]);
  const now = new Date().toISOString();
  let moved = 0;
  for (const d of list) {
    if (!d.client_id) continue;
    const to = stageForPhase(d.stage, phaseOf(byClient.get(d.client_id) || []));
    if (!to) continue;
    const { error } = await db.from('crm_deals').update({ stage: to, stage_changed_at: now, updated_at: now }).eq('id', d.id).eq('stage', d.stage);
    if (!error) moved++;
  }
  return moved;
}

export const syncFinishedStages = (ws: string): Promise<number> =>
  memo(`finished-sync:${ws}`, 600_000, async () => { try { return await run(ws); } catch (e) { console.error('finished sync failed', e); return 0; } });
