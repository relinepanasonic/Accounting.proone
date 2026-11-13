import { createAdminClient } from '@/lib/api/supabase-admin';
import { metaAccounts, subscribePage } from '@/lib/meta/send';

/**
 * The apps the sales chat is connected to: the WhatsApp sales number (Fonnte), and Instagram + Facebook Messenger (Meta, our Page).
 * "Connect" reads the Page and its Instagram account with META_PAGE_TOKEN, adds them as sales accounts, and subscribes the Page to the webhook.
 * The secrets themselves stay in the server's settings: this only says which ones are there.
 */
type Fail = { ok: false; status: number; error: string };

export const META_WEBHOOK_PATH = '/api/meta/webhook';

export async function channelStatus(ws: string) {
  const { data } = await createAdminClient().from('wa_devices').select('id, phone, label, active, role, created_at').eq('workspace_id', ws).eq('role', 'sales').order('created_at', { ascending: true });
  const rows = (data || []) as Array<{ id: string; phone: string; label: string | null; active: boolean }>;
  const kind = (p: string) => (p.startsWith('ig:') ? 'instagram' : p.startsWith('fb:') ? 'messenger' : 'whatsapp');
  return {
    accounts: rows.map((r) => ({ id: r.id, channel: kind(r.phone), name: r.label || (kind(r.phone) === 'whatsapp' ? `+${r.phone}` : r.phone), active: r.active })),
    meta: {
      pageToken: !!process.env.META_PAGE_TOKEN, appSecret: !!process.env.META_APP_SECRET, verifyToken: !!process.env.META_VERIFY_TOKEN, appId: !!process.env.META_APP_ID,
      webhookPath: META_WEBHOOK_PATH,
    },
  };
}

export async function connectMeta(ws: string): Promise<{ ok: true; page: string; instagram: string | null; subscribed: boolean; warning: string | null } | Fail> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) return { ok: false, status: 400, error: 'Put the Page token in META_PAGE_TOKEN on the server first (Vercel → Settings → Environment Variables), then redeploy.' };
  const acc = await metaAccounts(token);
  if (!acc.ok) return { ok: false, status: 400, error: acc.error };
  const db = createAdminClient();
  const rows = [{ workspace_id: ws, phone: `fb:${acc.page.id}`, label: `Messenger: ${acc.page.name}`, role: 'sales', active: true }];
  if (acc.instagram) rows.push({ workspace_id: ws, phone: `ig:${acc.instagram.id}`, label: `Instagram: @${acc.instagram.username || acc.instagram.id}`, role: 'sales', active: true });
  const { error } = await db.from('wa_devices').upsert(rows, { onConflict: 'workspace_id,phone' });
  if (error) return { ok: false, status: 500, error: error.message };
  const sub = await subscribePage(acc.page.id, token);
  return {
    ok: true, page: acc.page.name, instagram: acc.instagram ? `@${acc.instagram.username}` : null, subscribed: sub.ok,
    warning: !acc.instagram ? 'No Instagram account is linked to this Page. Link it in the Instagram app (Settings → Accounts Center), then press Connect again.' : !sub.ok ? `The Page could not subscribe to messages: ${sub.error}` : null,
  };
}

/** Switches one connected account off (its chats stay) or on again. */
export async function setChannelActive(ws: string, id: string, active: boolean): Promise<{ ok: true } | Fail> {
  const { data, error } = await createAdminClient().from('wa_devices').update({ active }).eq('id', id).eq('workspace_id', ws).eq('role', 'sales').or('phone.like.fb:%,phone.like.ig:%').select('id').maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  return data ? { ok: true } : { ok: false, status: 404, error: 'Only Instagram and Messenger accounts can be switched here.' };
}
