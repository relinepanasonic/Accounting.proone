/**
 * The WhatsApp groups Oli's number belongs to, asked from Fonnte (with their real names and ids). Server-side only (uses FONNTE_TOKEN).
 *   POST https://api.fonnte.com/get-whatsapp-group  ->  { status: true, data: [{ id: "1203...@g.us", name: "Group name" }, ...] }
 *   POST https://api.fonnte.com/fetch-group         ->  refreshes Fonnte's list from WhatsApp. Fonnte says to call it only when the number joined a new
 *                                                       group (and warns that abusing it can get the number banned), so it is never called on its own.
 * The webhook never tells us a group's name, so this is where the names come from.
 */

export const FONNTE_GET_GROUPS_URL = 'https://api.fonnte.com/get-whatsapp-group';
export const FONNTE_FETCH_GROUPS_URL = 'https://api.fonnte.com/fetch-group';

export interface FonnteGroup { waId: string; name: string }
export type GroupsResult = { ok: true; groups: FonnteGroup[] } | { ok: false; error: string };

/** "120363012345678901@g.us" -> "120363012345678901" (the ERP keeps the id without the suffix; sending adds it back). */
export const groupIdOf = (id: unknown): string => String(id ?? '').trim().replace(/@g\.us$/i, '');

export function parseGroups(json: any): FonnteGroup[] {
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  const seen = new Set<string>();
  const out: FonnteGroup[] = [];
  for (const r of rows) {
    const waId = groupIdOf(r?.id);
    if (!/^\d[\d-]{8,}$/.test(waId) || seen.has(waId)) continue;
    seen.add(waId);
    out.push({ waId, name: String(r?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) });
  }
  return out;
}

async function post(url: string, token: string, f: typeof fetch): Promise<{ ok: boolean; json: any; status: number }> {
  const res = await f(url, { method: 'POST', headers: { Authorization: token }, signal: AbortSignal.timeout(45000) });
  let json: any = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  const accepted = !!json && (json.status === true || json.Status === true);
  return { ok: res.ok && accepted, json, status: res.status };
}

/** Asks Fonnte for the groups. With `refresh`, Fonnte's list is refreshed from WhatsApp first (use only after Oli joined a new group). */
export async function fetchFonnteGroups(opts: { refresh?: boolean; token?: string; fetchImpl?: typeof fetch } = {}): Promise<GroupsResult> {
  const token = opts.token ?? process.env.FONNTE_TOKEN;
  if (!token) return { ok: false, error: 'FONNTE_TOKEN is not set on the server.' };
  const f = opts.fetchImpl ?? fetch;
  try {
    if (opts.refresh) {
      const r = await post(FONNTE_FETCH_GROUPS_URL, token, f);
      if (!r.ok) return { ok: false, error: `Fonnte could not refresh the group list: ${r.json?.detail || r.json?.reason || `HTTP ${r.status}`}` };
    }
    const r = await post(FONNTE_GET_GROUPS_URL, token, f);
    if (!r.ok) {
      const why = String(r.json?.detail || r.json?.reason || `HTTP ${r.status}`);
      // Fonnte answers this when its list was never filled: a refresh is then the way forward.
      return { ok: false, error: /no whatsapp group yet/i.test(why) ? `${why}. Press "Refresh from WhatsApp" once to fill Fonnte's list.` : `Fonnte refused: ${why}` };
    }
    return { ok: true, groups: parseGroups(r.json) };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'Fonnte took too long to answer.' : `Could not reach Fonnte: ${e?.message || e}` };
  }
}
