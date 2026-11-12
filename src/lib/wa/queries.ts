import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES, type WorkspaceContextInfo } from '@/lib/auth/workspace-context';
import { normalizeIdPhone, type WaMsg, type WaPerson } from './stats';

export const TEAM_ROLES = ['admin', 'advertiser', 'sales'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** WhatsApp chats are private: only finance roles (founder, superadmin, accounting, admin) may open WA Control. */
export async function waAccess(): Promise<WorkspaceContextInfo | null> {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  return FINANCE_ROLES.includes(ctx.role) && ctx.activeWorkspaceId ? ctx : null;
}

export interface WaGroupRow { id: string; wa_id: string; name: string | null; is_group: boolean; tracked: boolean; last_message_at: string | null }

/** Everyone on the ERP team of this workspace, with the WhatsApp number we know for them. */
export async function loadPeople(workspaceId: string) {
  const db = createAdminClient();
  const [{ data: members }, { data: links }] = await Promise.all([
    db.from('workspace_members').select('user_id, role').eq('workspace_id', workspaceId),
    db.from('wa_members').select('phone, display_name, user_id, is_team').eq('workspace_id', workspaceId),
  ]);
  const ids = (members || []).map((m: any) => m.user_id).filter(Boolean);
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, email, phone').in('id', ids) : { data: [] as any[] };
  const prof = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

  // A number linked by hand on the dashboard wins over the number in the ERP profile.
  const linkedPhone = new Map<string, string>();
  for (const l of links || []) if (l.user_id) linkedPhone.set(l.user_id, l.phone);

  const roster: WaPerson[] = (members || [])
    .filter((m: any) => m.user_id && m.role !== 'client')
    .map((m: any) => {
      const p = prof.get(m.user_id);
      const email: string = p?.email || '';
      return {
        phone: linkedPhone.get(m.user_id) || normalizeIdPhone(p?.phone),
        name: p?.full_name || email.split('@')[0] || 'Staff',
        role: m.role as string,
        userId: m.user_id as string,
        isTeam: true,
      };
    });

  const byPhone = new Map<string, WaPerson>();
  for (const p of roster) if (p.phone) byPhone.set(p.phone, p);
  // A number marked as staff but without an ERP account still counts as team (for response times).
  for (const l of links || []) {
    if (l.is_team && !byPhone.has(l.phone)) byPhone.set(l.phone, { phone: l.phone, name: l.display_name || l.phone, role: null, userId: null, isTeam: true });
  }
  return { roster, byPhone };
}

/** Reads every row (Supabase returns at most 1000 per request) up to `cap`. */
async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, cap = 8000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadGroups(workspaceId: string): Promise<WaGroupRow[]> {
  const db = createAdminClient();
  const { data } = await db.from('wa_groups').select('id, wa_id, name, is_group, tracked, last_message_at').eq('workspace_id', workspaceId).order('last_message_at', { ascending: false, nullsFirst: false });
  return (data || []) as WaGroupRow[];
}

/** Messages since `sinceIso`, oldest first (what the stats need). */
export async function loadMessages(workspaceId: string, sinceIso: string, groupId?: string | null): Promise<WaMsg[]> {
  const db = createAdminClient();
  return readAll<WaMsg>((from, to) => {
    let q = db.from('wa_messages')
      .select('group_id, sender_phone, sender_name, body, media_type, is_from_me, sent_at')
      .eq('workspace_id', workspaceId).gte('sent_at', sinceIso).order('sent_at', { ascending: true }).range(from, to);
    if (groupId) q = q.eq('group_id', groupId);
    return q as any;
  });
}

export const sinceDays = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
export const parseDays = (v: string | string[] | undefined): 1 | 7 | 30 => (v === '7' ? 7 : v === '30' ? 30 : 1);
