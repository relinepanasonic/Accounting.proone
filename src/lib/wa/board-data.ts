import { createAdminClient } from '@/lib/api/supabase-admin';
import { cellOf, monthWeeks, parseSessionRef, weekDates, type BoardCell, type DayCell, type MonthWeek } from './board';

export interface BoardRow { store: string; client: string; weeks: BoardCell[]; monthly: BoardCell }
export interface Board { month: string; weeks: MonthWeek[]; rows: BoardRow[] }

/** The monthly table: one row per store that has a weekly report this month, a cell per week, and the Monthly Report cell. */
export async function loadBoard(workspaceId: string, month: string): Promise<Board> {
  const db = createAdminClient();
  const weeks = monthWeeks(month);
  if (weeks.length === 0) return { month, weeks, rows: [] };

  const [{ data: weekly }, { data: monthly }] = await Promise.all([
    db.from('wa_outbox').select('id, store_label, client_name, period_from, status')
      .eq('workspace_id', workspaceId).eq('kind', 'client-weekly').gte('period_from', weeks[0].from).lte('period_from', weeks[weeks.length - 1].from),
    db.from('wa_outbox').select('id, store_label, client_name, status')
      .eq('workspace_id', workspaceId).eq('kind', 'client-monthly').eq('period_from', `${month}-01`),
  ]);

  const stores = new Map<string, BoardRow>();
  const row = (store: string, client: string | null) => {
    let r = stores.get(store);
    if (!r) { r = { store, client: client || '', weeks: weeks.map(() => ({ state: 'none' as const })), monthly: { state: 'none' } }; stores.set(store, r); }
    if (!r.client && client) r.client = client;
    return r;
  };
  for (const o of weekly || []) {
    const i = weeks.findIndex((w) => w.from === o.period_from);
    if (i >= 0) row(o.store_label, o.client_name).weeks[i] = cellOf(o);
  }
  for (const o of monthly || []) row(o.store_label, o.client_name).monthly = cellOf(o);

  const rows = Array.from(stores.values()).sort((a, b) => (a.client || a.store).localeCompare(b.client || b.store) || a.store.localeCompare(b.store));
  return { month, weeks, rows };
}

export interface WeekDetail { client: string | null; clientId: string | null; days: DayCell[]; week: BoardCell }

/**
 * One store, one week: for each day, how many advertiser session reports were logged and how many of them Oli sent to the client group;
 * and the weekly report of that week.
 */
export async function loadWeekDetail(workspaceId: string, store: string, weekFrom: string): Promise<WeekDetail> {
  const db = createAdminClient();
  const dates = weekDates(weekFrom);
  const to = dates[6];

  const [{ data: cl }, { data: wk }] = await Promise.all([
    db.from('clients').select('id, name').eq('workspace_id', workspaceId).eq('store_name', store).limit(1).maybeSingle(),
    db.from('wa_outbox').select('id, status').eq('workspace_id', workspaceId).eq('kind', 'client-weekly').eq('store_label', store).eq('period_from', weekFrom).maybeSingle(),
  ]);
  const clientId: string | null = cl?.id || null;
  const days: DayCell[] = dates.map((date) => ({ date, logged: 0, sent: 0, sendId: null, hasCopy: false }));
  const at = new Map(days.map((d) => [d.date, d]));

  if (clientId) {
    const [{ data: logs }, { data: sends }] = await Promise.all([
      db.from('advertiser_reports').select('report_date, session, store_label').eq('workspace_id', workspaceId).eq('client_id', clientId).gte('report_date', weekFrom).lte('report_date', to),
      db.from('wa_sends').select('id, ref, report_date, file_path, created_at').eq('workspace_id', workspaceId).eq('kind', 'session').eq('ok', true).like('ref', `${clientId}|%`).gte('report_date', weekFrom).lte('report_date', to).order('created_at', { ascending: true }),
    ]);
    const mine = (s: string | null | undefined) => !s || s === store;   // a client with one store logs without a store label
    const seenLogged = new Set<string>();
    for (const l of logs || []) {
      const k = `${l.report_date}|${l.session}`;
      if (!mine(l.store_label) || seenLogged.has(k)) continue;
      seenLogged.add(k);
      const d = at.get(l.report_date as string);
      if (d) d.logged++;
    }
    const seenSent = new Set<string>();
    for (const s of sends || []) {
      const ref = parseSessionRef(s.ref);
      if (!ref || !mine(ref.store)) continue;
      const d = at.get(ref.date);
      if (!d) continue;
      const k = `${ref.date}|${ref.session}`;
      if (!seenSent.has(k)) { seenSent.add(k); d.sent++; }
      if (s.file_path) { d.sendId = s.id as string; d.hasCopy = true; }   // the latest copy of that day wins (ordered oldest first)
      else if (!d.hasCopy) d.sendId = s.id as string;
    }
    // sessions sent but never logged on that day (logged < sent) still count as logged
    for (const d of days) if (d.logged < d.sent) d.logged = d.sent;
  }
  return { client: cl?.name || null, clientId, days, week: cellOf(wk as any) };
}
