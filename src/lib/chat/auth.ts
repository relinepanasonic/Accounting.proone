import { createAdminClient } from '@/lib/api/supabase-admin';
import { createHash } from 'crypto';
import { isFounderEmail } from '@/lib/auth/founders';
import { forget, memo } from './cache';

/**
 * Who may use the chat dashboard API. The dashboard is a separate app: it signs people in with the same ERP login (shared cookie) and
 * forwards the person's own access token here as "Authorization: Bearer <token>". We check the token with Supabase and the person's role in
 * the company that owns the sales number. No shared master key: every call is a named person, and a sent message records who sent it.
 */
export const CHAT_ROLES = ['founder', 'superadmin', 'admin', 'sales'] as const;

export interface ChatUser { userId: string; name: string; email: string; role: string; workspaceId: string }

const USER_TTL_MS = 60_000;

/**
 * The person behind the Bearer token, or null. The answer is kept for a minute per token (never the token itself: only its hash), so the
 * inbox polling every few seconds does not ask Supabase who this is every time. A refused token is never kept.
 */
export async function chatUser(request: Request): Promise<ChatUser | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.split('.').length !== 3) return null;
  const key = `user:${createHash('sha256').update(token).digest('hex')}`;
  const user = await memo(key, USER_TTL_MS, () => lookupUser(token));
  if (!user) forget(key);
  return user;
}

/** The company that owns the sales number (kept for a minute). */
export const salesWorkspaceId = () => memo('sales-ws', 60_000, async () => {
  const { data: dev } = await createAdminClient().from('wa_devices').select('workspace_id').eq('role', 'sales').eq('active', true).limit(1).maybeSingle();
  return (dev?.workspace_id as string | undefined) ?? null;
});

async function lookupUser(token: string): Promise<ChatUser | null> {
  const db = createAdminClient();
  const { data: auth, error } = await db.auth.getUser(token);
  const user = auth?.user;
  if (error || !user) return null;

  const workspaceId = await salesWorkspaceId();
  if (!workspaceId) return null;

  let role = '';
  if (isFounderEmail(user.email)) role = 'founder';
  else {
    const { data: byUser } = await db.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    let row = byUser;
    if (!row && user.email) ({ data: row } = await db.from('workspace_members').select('role').eq('workspace_id', workspaceId).ilike('email', user.email.trim()).maybeSingle());
    role = String(row?.role || '');
  }
  if (!(CHAT_ROLES as readonly string[]).includes(role)) return null;
  const name = String(user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0] || 'Team');
  return { userId: user.id, name, email: user.email || '', role, workspaceId };
}

/** Who may change the AI Bible (the Sales Deck, the bot's script and settings). Everyone with a chat role may read it and ask it questions. */
export const BIBLE_EDITORS = ['founder', 'superadmin', 'admin'] as const;
