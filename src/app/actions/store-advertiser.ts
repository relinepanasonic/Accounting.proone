'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

/** Assign a store (Profesor Dashboard) or dealer (Reline) to an advertiser by hand; null removes it (the automatic match from Clients applies again). */
export async function setStoreAdvertiser(storeKey: string, advertiserId: string | null): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || (ctx.role !== 'superadmin' && ctx.role !== 'founder')) return { success: false, error: 'Only the owners can assign a store to an advertiser.' };
  if (!storeKey || storeKey.length > 300) return { success: false, error: 'Unknown store.' };
  const db = createAdminClient();
  const { error } = advertiserId
    ? await db.from('perf_store_advertiser').upsert({ store_key: storeKey, advertiser_id: advertiserId, updated_at: new Date().toISOString() })
    : await db.from('perf_store_advertiser').delete().eq('store_key', storeKey);
  if (error) return { success: false, error: /perf_store_advertiser|42P01|PGRST205/.test(`${error.code} ${error.message}`) ? 'Run supabase/migrations/20261026_perf_store_advertiser.sql in Supabase first.' : error.message };
  return { success: true };
}
