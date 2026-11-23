import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadClientStores, storeText } from '@/lib/sales/client-stores';

/** Puts the stores ("Company - Store") of each client on the client rows of the invoice form, for the "which store is this invoice for" choice. */
export async function attachStores(clients: any[]): Promise<void> {
  try {
    const ids = clients.map((c) => c?.id).filter(Boolean);
    if (!ids.length) return;
    const map = await loadClientStores(createAdminClient(), ids);
    for (const c of clients) c.stores = (map.get(c.id) || []).map((s) => storeText(s));
  } catch { /* no store list: the form works without it */ }
}
