// Staff activity report: what each person actually did, from data the app already records.
// Server-side only. Everything is read with the signed-in user's own session, so database rules apply:
// a superadmin can read the whole team, everyone else only gets rows they are allowed to see.
import { getDashboardUploadLog, jakartaDay, LOG_TIMEZONE } from '@/lib/integrations/dashboard-uploads';

type Db = any;

export type RangeKey = 'today' | 'week' | 'month';
export const parseRange = (v: string | undefined): RangeKey => (v === 'today' || v === 'month' ? v : 'week');

/** Calendar bounds in Jakarta time. "week" starts on Monday. */
export function rangeBounds(range: RangeKey) {
  const today = jakartaDay(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  let from = today;
  if (range === 'week') from = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
  if (range === 'month') from = `${today.slice(0, 8)}01`;
  const days = Math.round((d.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000) + 1;
  const label = range === 'today' ? 'Today' : range === 'week' ? 'This week (Mon to today)' : 'This month';
  return { from, to: today, days, label, fromTs: new Date(`${from}T00:00:00+07:00`).toISOString() };
}

export interface Person {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface AdvertiserEvent {
  date: string; // YYYY-MM-DD, the day the report is for
  session: number;
  client: string;
  at: string; // when it was saved
}
export interface SalesEvent {
  title: string;
  stage: string;
  value: number;
  kind: 'new' | 'moved' | 'won';
  at: string;
}
export interface AdminEvent {
  at: string;
  type: string;
  store: string;
  files: number;
}

export interface PersonActivity {
  person: Person;
  advertiser: AdvertiserEvent[];
  sales: SalesEvent[];
  admin: AdminEvent[];
  lastActive: string | null;
}

export interface UnlinkedActivity {
  name: string;
  count: number;
  lastActive: string | null;
}

const STAFF_ROLES = ['superadmin', 'accounting', 'admin', 'advertiser'];

/** Names a person may appear under in other systems (sales deals, the dashboard app). */
export const nameKeys = (p: Person) => {
  const full = p.name.trim().toLowerCase();
  const first = full.split(/\s+/)[0];
  const local = p.email.split('@')[0].toLowerCase();
  return new Set([full, first, local].filter(Boolean));
};

export async function loadPeople(db: Db, workspaceId: string, onlyUserId?: string): Promise<Person[]> {
  let query = db
    .from('workspace_members')
    .select('user_id, role, display_name, email')
    .eq('workspace_id', workspaceId)
    .not('user_id', 'is', null)
    .in('role', STAFF_ROLES);
  if (onlyUserId) query = query.eq('user_id', onlyUserId);

  const { data: members } = await query;
  const ids = (members || []).map((m: any) => m.user_id as string);
  if (ids.length === 0) return [];

  const { data: profiles } = await db.from('profiles').select('id, full_name, email').in('id', ids);
  const byId = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

  return (members || [])
    .map((m: any) => {
      const profile = byId.get(m.user_id);
      const email = String(profile?.email || m.email || '');
      return {
        userId: m.user_id as string,
        name: String(profile?.full_name || m.display_name || email.split('@')[0] || 'Unknown'),
        email,
        role: m.role as string,
      };
    })
    .sort((a: Person, b: Person) => a.name.localeCompare(b.name));
}

const maxIso = (list: (string | null | undefined)[]) =>
  list.filter(Boolean).reduce<string | null>((best, x) => (!best || new Date(x as string) > new Date(best) ? (x as string) : best), null);

export async function loadActivity(db: Db, workspaceId: string, people: Person[], range: RangeKey) {
  const b = rangeBounds(range);
  const ids = people.map((p) => p.userId);

  // 1. Advertisers: every session they saved in the period.
  const advertiserByUser = new Map<string, AdvertiserEvent[]>();
  if (ids.length > 0) {
    const { data: reports } = await db
      .from('advertiser_reports')
      .select('user_id, report_date, session, created_at, updated_at, clients ( name )')
      .eq('workspace_id', workspaceId)
      .in('user_id', ids)
      .gte('report_date', b.from)
      .lte('report_date', b.to)
      .order('report_date', { ascending: false })
      .limit(3000);
    (reports || []).forEach((r: any) => {
      const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const list = advertiserByUser.get(r.user_id) || [];
      list.push({ date: r.report_date, session: r.session, client: client?.name || 'Unknown client', at: r.updated_at || r.created_at });
      advertiserByUser.set(r.user_id, list);
    });
  }

  // 2. Sales: deals owned by a salesperson (matched by name) that were created or changed in the period.
  const salesByName = new Map<string, SalesEvent[]>();
  const { data: deals } = await db
    .from('crm_deals')
    .select('title, lead_name, value, stage, salesman_name, created_at, updated_at, clients ( name )')
    .eq('workspace_id', workspaceId)
    .gte('updated_at', b.fromTs)
    .order('updated_at', { ascending: false })
    .limit(2000);
  (deals || []).forEach((d: any) => {
    const owner = String(d.salesman_name || '').trim().toLowerCase();
    if (!owner) return;
    const client = Array.isArray(d.clients) ? d.clients[0] : d.clients;
    const created = new Date(d.created_at) >= new Date(b.fromTs);
    const won = d.stage === 'Deal' || d.stage === 'Won';
    const list = salesByName.get(owner) || [];
    list.push({
      title: `${client?.name || d.lead_name || 'Unknown'}: ${d.title || 'Deal'}`,
      stage: d.stage,
      value: Number(d.value || 0),
      kind: won ? 'won' : created ? 'new' : 'moved',
      at: d.updated_at,
    });
    salesByName.set(owner, list);
  });

  // 3. Admin: uploads recorded by the dashboard app (matched by name).
  const adminByName = new Map<string, AdminEvent[]>();
  let adminLogError: string | null = null;
  const log = await getDashboardUploadLog(Math.min(Math.max(b.days, 1), 60));
  if (log.ok) {
    log.uploads.forEach((u) => {
      const day = jakartaDay(new Date(u.uploadedAt));
      if (day < b.from || day > b.to) return;
      const key = String(u.admin || '').trim().toLowerCase();
      const list = adminByName.get(key) || [];
      list.push({ at: u.uploadedAt, type: u.type, store: u.store || '-', files: u.files?.length || 0 });
      adminByName.set(key, list);
    });
  } else {
    adminLogError = log.error;
  }

  // 4. Put it together per person, and remember what could not be matched to an ERP user.
  const usedSales = new Set<string>();
  const usedAdmin = new Set<string>();

  const activities: PersonActivity[] = people.map((person) => {
    const keys = nameKeys(person);
    const sales: SalesEvent[] = [];
    const admin: AdminEvent[] = [];
    salesByName.forEach((events, key) => {
      if (keys.has(key)) {
        sales.push(...events);
        usedSales.add(key);
      }
    });
    adminByName.forEach((events, key) => {
      if (keys.has(key)) {
        admin.push(...events);
        usedAdmin.add(key);
      }
    });
    const advertiser = advertiserByUser.get(person.userId) || [];
    return {
      person,
      advertiser,
      sales,
      admin,
      lastActive: maxIso([...advertiser.map((e) => e.at), ...sales.map((e) => e.at), ...admin.map((e) => e.at)]),
    };
  });

  const unlinked = (map: Map<string, { at: string }[]>, used: Set<string>): UnlinkedActivity[] =>
    Array.from(map.entries())
      .filter(([key]) => !used.has(key))
      .map(([name, events]) => ({ name, count: events.length, lastActive: maxIso(events.map((e) => e.at)) }))
      .sort((a, c) => c.count - a.count);

  return {
    bounds: b,
    activities,
    salesUnlinked: unlinked(salesByName, usedSales),
    adminUnlinked: unlinked(adminByName, usedAdmin),
    adminLogError,
  };
}

// ---- display helpers (Jakarta time) ----
export const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: LOG_TIMEZONE, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'no activity';
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: LOG_TIMEZONE, hour: '2-digit', minute: '2-digit' });
export const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: LOG_TIMEZONE, weekday: 'short', day: '2-digit', month: 'short' });
export const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
