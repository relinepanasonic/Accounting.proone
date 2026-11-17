import { createAdminClient } from '@/lib/api/supabase-admin';
import { forget } from './cache';

/**
 * The sales team of the chat dashboard: a list of { id, name } kept in the bot settings. Pure cleaning here; the rest reads and saves it.
 */
export interface TeamPerson { id: string; name: string; phone?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A WhatsApp number as 62xxxxxxxxxx: "0812-345", "+62 812 345" and "812345" all read the same. Empty when it is not a plausible number. */
export function normalizePhone(raw: unknown): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^\d{9,15}$/.test(d) ? d : '';
}

/** Real ids only, each once, at most 20, a name for each, and the WhatsApp number that may command Fefe ("Hi Fefe") when given. */
export function cleanTeam(raw: unknown): TeamPerson[] {
  const seen = new Set<string>();
  const out: TeamPerson[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const id = String((x as any)?.id ?? '').toLowerCase();
    if (!UUID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const phone = normalizePhone((x as any)?.phone);
    out.push({ id, name: String((x as any)?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sales', ...(phone ? { phone } : {}) });
  }
  return out.slice(0, 20);
}

/** Everyone in the company, once each, with whether they are in the sales team now (for the picker in AI Kamus). */
export async function teamOverview(ws: string) {
  const db = createAdminClient();
  const [{ data: members }, { data: cfg }] = await Promise.all([
    db.from('workspace_members').select('user_id, role, email').eq('workspace_id', ws).not('user_id', 'is', null),
    db.from('wa_bot_config').select('sales_team').eq('workspace_id', ws).maybeSingle(),
  ]);
  const ids = Array.from(new Set(((members || []) as any[]).map((m) => m.user_id as string)));
  const { data: profs } = ids.length ? await db.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
  const teamList = cleanTeam((cfg as any)?.sales_team);
  const team = new Set(teamList.map((p) => p.id));
  const phoneOf = new Map(teamList.map((p) => [p.id, p.phone || '']));
  const roleOf = new Map<string, string>();
  for (const m of (members || []) as any[]) if (!roleOf.has(m.user_id)) roleOf.set(m.user_id, String(m.role));
  const people = ids.map((id) => ({
    id, role: roleOf.get(id) || '', inTeam: team.has(id), phone: phoneOf.get(id) || '',
    name: String(((profs || []) as any[]).find((p) => p.id === id)?.full_name || '').trim() || String(((members || []) as any[]).find((m) => m.user_id === id)?.email || '').split('@')[0] || 'Team',
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { people };
}

/** Saves the sales team. Only people of this company can be in it. */
export async function saveTeam(ws: string, raw: unknown): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const wanted = cleanTeam(raw);
  let team: TeamPerson[] = [];
  if (wanted.length) {
    const { data: mem } = await db.from('workspace_members').select('user_id').eq('workspace_id', ws).in('user_id', wanted.map((p) => p.id));
    const ok = new Set(((mem || []) as any[]).map((m) => m.user_id as string));
    team = wanted.filter((p) => ok.has(p.id));
    // one number belongs to one person
    const seen = new Set<string>();
    team = team.map((p) => { if (p.phone && seen.has(p.phone)) { const { phone: _x, ...rest } = p; return rest; } if (p.phone) seen.add(p.phone); return p; });
  }
  const { error } = await db.from('wa_bot_config').upsert({ workspace_id: ws, sales_team: team, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) return { ok: false, status: 500, error: /column/.test(error.message) ? 'The sales team is not in the database yet: run the SQL first.' : error.message };
  forget(`agents:${ws}`);
  return { ok: true };
}
