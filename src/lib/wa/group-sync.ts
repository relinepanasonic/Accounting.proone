import { createAdminClient } from '@/lib/api/supabase-admin';
import { fetchFonnteGroups } from './fonnte-groups';

export type GroupSyncResult = { ok: true; found: number; created: number; named: number } | { error: string };

/**
 * Fills a company's chat list from Fonnte: every WhatsApp group Oli's number is in, with its real name. New groups are added; a group with
 * no name yet gets it; names typed by hand are never overwritten. With `refresh`, Fonnte re-reads the list from WhatsApp first (Fonnte warns that
 * overusing that can get the number banned). Used by the button on the Dashboard and by the daily job.
 */
export async function syncGroupsFor(workspaceId: string, refresh = false): Promise<GroupSyncResult> {
  const r = await fetchFonnteGroups({ refresh });
  if (!r.ok) return { error: r.error };

  const db = createAdminClient();
  const [{ data: dev }, { data: existing }] = await Promise.all([
    db.from('wa_devices').select('id').eq('workspace_id', workspaceId).eq('active', true).limit(1).maybeSingle(),
    db.from('wa_groups').select('id, wa_id, name').eq('workspace_id', workspaceId),
  ]);
  const byId = new Map((existing || []).map((g: any) => [g.wa_id as string, g as { id: string; wa_id: string; name: string | null }]));

  const inserts: Record<string, unknown>[] = [];
  let named = 0;
  for (const g of r.groups) {
    const ex = byId.get(g.waId);
    if (!ex) inserts.push({ workspace_id: workspaceId, device_id: dev?.id || null, wa_id: g.waId, name: g.name || null, is_group: true });
    else if (!ex.name && g.name) {
      const { error } = await db.from('wa_groups').update({ name: g.name }).eq('id', ex.id);
      if (!error) named++;
    }
  }
  let created = 0;
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100);
    const { error } = await db.from('wa_groups').insert(chunk);
    if (error) return { error: `Could not save the groups: ${error.message}` };
    created += chunk.length;
  }
  return { ok: true, found: r.groups.length, created, named };
}
