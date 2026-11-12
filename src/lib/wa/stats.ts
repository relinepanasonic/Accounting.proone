/** Pure helpers for the WA Control pages: phone matching, per-person counts and response times. */

/** 0812-3456-7890, +62 812..., 62812... and 812... all become 628123456789 0. Digits only. */
export function normalizeIdPhone(v: string | null | undefined): string {
  const d = (v || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('62')) return d;
  if (d.startsWith('0')) return '62' + d.slice(1);
  if (d.startsWith('8')) return '62' + d;
  return d;
}

export interface WaMsg {
  group_id: string;
  sender_phone: string | null;
  sender_name: string | null;
  body: string | null;
  media_type: string | null;
  is_from_me: boolean;
  sent_at: string;
}

export interface WaPerson {
  phone: string;           // normalised, '' when the ERP profile has no number
  name: string;
  role: string | null;     // workspace role: admin / advertiser / sales / ...
  userId: string | null;
  isTeam: boolean;
}

export interface MemberStat {
  key: string;             // phone, or userId when the person has no number yet
  phone: string;
  name: string;
  role: string | null;
  messages: number;
  media: number;
  groups: number;
  lastAt: string | null;
  medianReplyMin: number | null;
  replies: number;
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * How long a team member takes to answer. In each chat a customer message starts the clock; the first team
 * message after it stops it, and the minutes are credited to that team member. Gaps over 24h are not replies.
 * Messages must be oldest first.
 */
export function responseTimes(msgs: WaMsg[], isTeam: (phone: string | null, m: WaMsg) => boolean): Map<string, number[]> {
  const waiting = new Map<string, number>();   // group_id -> time of the oldest unanswered customer message
  const out = new Map<string, number[]>();
  for (const m of msgs) {
    const t = new Date(m.sent_at).getTime();
    if (isTeam(m.sender_phone, m)) {
      const start = waiting.get(m.group_id);
      if (start !== undefined) {
        const mins = (t - start) / 60000;
        if (mins >= 0 && mins <= 24 * 60 && m.sender_phone) {
          const arr = out.get(m.sender_phone) || [];
          arr.push(mins);
          out.set(m.sender_phone, arr);
        }
        waiting.delete(m.group_id);
      }
    } else if (!waiting.has(m.group_id)) {
      waiting.set(m.group_id, t);
    }
  }
  return out;
}

/** One row per person: the roster first (so someone silent still shows with 0), then any other sender seen. */
export function memberStats(msgs: WaMsg[], roster: WaPerson[], byPhone: Map<string, WaPerson>, replies: Map<string, number[]>): MemberStat[] {
  const rows = new Map<string, MemberStat & { groupSet: Set<string> }>();
  const ensure = (key: string, phone: string, name: string, role: string | null) => {
    let r = rows.get(key);
    if (!r) {
      r = { key, phone, name, role, messages: 0, media: 0, groups: 0, lastAt: null, medianReplyMin: null, replies: 0, groupSet: new Set() };
      rows.set(key, r);
    }
    return r;
  };
  for (const p of roster) ensure(p.phone || p.userId || p.name, p.phone, p.name, p.role);
  for (const m of msgs) {
    if (!m.sender_phone) continue;
    const p = byPhone.get(m.sender_phone);
    const r = ensure(m.sender_phone, m.sender_phone, p?.name || m.sender_name || m.sender_phone, p?.role ?? null);
    r.messages++;
    if (m.media_type) r.media++;
    r.groupSet.add(m.group_id);
    if (!r.lastAt || m.sent_at > r.lastAt) r.lastAt = m.sent_at;
  }
  return [...rows.values()].map(({ groupSet, ...r }) => {
    const rt = replies.get(r.phone) || [];
    return { ...r, groups: groupSet.size, replies: rt.length, medianReplyMin: median(rt) };
  }).sort((a, b) => b.messages - a.messages || a.name.localeCompare(b.name));
}

export const fmtMinutes = (m: number | null): string => {
  if (m === null) return '-';
  if (m < 1) return '<1 min';
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
};
