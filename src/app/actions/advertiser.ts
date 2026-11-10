'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { calendarFromReports, type InputReport, type StoreCalendar } from '@/lib/advertiser/input-series';
import { missingNumbers } from '@/lib/advertiser/log-rules';
import { actionable, buildRecommendations, type DayFigures } from '@/lib/advertiser/optimasi';

export async function fetchAdvertiserLogs() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch all reports to group them. store_label comes from 20261105_advertiser_report_store.sql; before it exists the logs are per client as they were.
  const cols = 'id, client_id, report_date, session, note, data_inkubasi, data_group, data_mandiri, created_at, user_id, clients ( name )';
  const read = (extra: string) => supabase.from('advertiser_reports').select(`${cols}${extra}`).eq('workspace_id', activeWorkspaceId).order('report_date', { ascending: false }).order('created_at', { ascending: false });
  let { data, error } = (await read(', store_label')) as any;
  if (error) ({ data, error } = (await read('')) as any);

  if (error) {
    console.error('Error fetching logs:', error);
    return { data: [] };
  }

  // Need to get user names from workspace_members or profiles
  // Since we don't easily have a direct link to profiles from advertiser_reports,
  // we will just fetch profiles separately for the user_ids found
  const userIds = [...new Set((data as any[]).filter((d: any) => d.user_id).map((d: any) => d.user_id))];
  let profiles: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    if (profs) {
      profs.forEach(p => {
        profiles[p.id] = p.full_name || p.email;
      });
    }
  }

  // Group by client + store + report_date
  // We want to show 1 row per (client, store, date) and show checkboxes for session 1, 2, 3
  const grouped: Record<string, any> = {};

  (data as any[]).forEach((row: any) => {
    const key = `${row.client_id}_${row.store_label || ''}_${row.report_date}`;
    if (!grouped[key]) {
      grouped[key] = {
        client_id: row.client_id,
        store_label: row.store_label || '',
        client_name: row.clients?.name || 'Unknown',
        report_date: row.report_date,
        advertiser_name: profiles[row.user_id] || 'Unknown',
        note: row.note || '',
        recommendation: '',
        created_at: row.created_at,
        sessions: { 1: false, 2: false, 3: false },
        drafts: { 1: false, 2: false, 3: false }
      };
    }
    grouped[key].sessions[row.session as 1|2|3] = true;
    // saved with Biaya Iklan / Penjualan still empty = a draft to finish
    try { grouped[key].drafts[row.session as 1|2|3] = missingNumbers(Array.isArray(row.data_inkubasi) ? row.data_inkubasi : [], Array.isArray(row.data_group) ? row.data_group : [], Array.isArray(row.data_mandiri) ? row.data_mandiri : []).length > 0; } catch { /* unreadable rows: not a draft */ }
    
    // Prefer earliest creation date for the Date Stamp
    if (new Date(row.created_at) < new Date(grouped[key].created_at)) {
      grouped[key].created_at = row.created_at;
    }
    // Prefer most recent note
    if (row.note && !grouped[key].note) {
      grouped[key].note = row.note;
    }

    // Keep the figures of the LAST session saved that day: the recommendation is read from them.
    if (!grouped[key]._figs || row.session >= grouped[key]._figsSession) {
      grouped[key]._figsSession = row.session;
      grouped[key]._figs = { date: row.report_date, data_inkubasi: row.data_inkubasi, data_group: row.data_group, data_mandiri: row.data_mandiri } as DayFigures;
    }
  });

  // OptimasiShopee: one set of recommendations per store and day, with the earlier days of that store as history.
  const figsByClient: Record<string, DayFigures[]> = {};
  Object.values(grouped).forEach((g: any) => {
    const k = `${g.client_id}|${g.store_label}`;
    (figsByClient[k] = figsByClient[k] || []).push(g._figs);
  });
  Object.values(grouped).forEach((g: any) => {
    const history = (figsByClient[`${g.client_id}|${g.store_label}`] || []).filter((f) => f.date < g._figs.date);
    g.recs = buildRecommendations(g._figs, history);
    g.recommendation = actionable(g.recs)[0]?.action || '';
    delete g._figs;
    delete g._figsSession;
  });

  return { data: Object.values(grouped).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) };
}

/** The log of one STORE of a client (storeLabel "Company - Store"). Before 20261105_advertiser_report_store.sql the store is ignored. */
export async function fetchAdvertiserReport(clientId: string, reportDate: string, session: number, storeLabel = '') {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const base = () => supabase.from('advertiser_reports').select('*').eq('workspace_id', activeWorkspaceId).eq('client_id', clientId);

  // Try to find the exact report
  let { data: exactReport, error: exactError } = await base().eq('store_label', storeLabel).eq('report_date', reportDate).eq('session', session).maybeSingle();
  if (exactError && /store_label/.test(exactError.message)) ({ data: exactReport, error: exactError } = await base().eq('report_date', reportDate).eq('session', session).maybeSingle());

  if (exactReport && !exactError) {
    return { data: exactReport, isHistorical: false, from: null as { date: string; session: number } | null };
  }

  // No log for this session yet: it starts from the session right before it (the earlier session of the same day, else the last one of an earlier day),
  // and only when there is none, from the latest log of the store.
  const before = () => base().or(`report_date.lt.${reportDate},and(report_date.eq.${reportDate},session.lt.${session})`).order('report_date', { ascending: false }).order('session', { ascending: false }).limit(1);
  let { data: prevReport, error: prevError } = await before().eq('store_label', storeLabel).maybeSingle();
  if (prevError && /store_label/.test(prevError.message)) ({ data: prevReport } = await before().maybeSingle());
  if (prevReport) return { data: prevReport, isHistorical: true, from: { date: prevReport.report_date as string, session: prevReport.session as number } };

  let { data: lastReport, error: lastError } = await base().eq('store_label', storeLabel).order('report_date', { ascending: false }).order('session', { ascending: false }).limit(1).maybeSingle();
  if (lastError && /store_label/.test(lastError.message)) ({ data: lastReport } = await base().order('report_date', { ascending: false }).order('session', { ascending: false }).limit(1).maybeSingle());

  if (lastReport) {
    return { data: lastReport, isHistorical: true, from: { date: lastReport.report_date as string, session: lastReport.session as number } };
  }

  return { data: null, isHistorical: false, from: null as { date: string; session: number } | null };
}

export async function saveAdvertiserReport(
  clientId: string,
  reportDate: string,
  session: number,
  data_inkubasi: any,
  data_group: any,
  data_mandiri: any,
  screenshotUrl: string | null,
  note: string | null,
  sisaSaldo: string | null = null,
  storeLabel = ''
) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: userData } = await supabase.auth.getUser();

  const base = {
    workspace_id: activeWorkspaceId,
    client_id: clientId,
    report_date: reportDate,
    session,
    data_inkubasi,
    data_group,
    data_mandiri,
    screenshot_url: screenshotUrl,
    user_id: userData?.user?.id,
    note,
    store_label: storeLabel,
  };

  let { error } = await supabase
    .from('advertiser_reports')
    .upsert({ ...base, sisa_saldo_iklan: sisaSaldo }, { onConflict: 'client_id, store_label, report_date, session' });

  // The store: 20261105_advertiser_report_store.sql. Until it is run the log is saved per client as before.
  if (error && (error.code === '42703' || error.code === 'PGRST204' || error.code === '42P10' || /store_label/.test(error.message))) {
    const { store_label: _s, ...old } = base;
    ({ error } = await supabase.from('advertiser_reports').upsert({ ...old, sisa_saldo_iklan: sisaSaldo }, { onConflict: 'client_id, report_date, session' }));
  }

  // The saldo column comes from supabase/migrations/20260930_advertiser_saldo.sql. Until that has been run,
  // save everything else instead of losing the whole session, and say so.
  if (error && (error.code === '42703' || error.code === 'PGRST204' || /sisa_saldo_iklan/.test(error.message))) {
    const retry = await supabase.from('advertiser_reports').upsert(base, { onConflict: 'client_id, report_date, session' });
    if (!retry.error) {
      return { success: true, warning: 'Saved, but Sisa Saldo Iklan was NOT stored: run supabase/migrations/20260930_advertiser_saldo.sql in Supabase first.' };
    }
    error = retry.error;
  }

  if (error) {
    console.error('Error saving advertiser report:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/** Everything one advertiser saved for one client on one day: every session, with who saved it and when. */
export async function fetchAdvertiserLogDetail(clientId: string, reportDate: string, storeLabel = '') {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const q = () => supabase.from('advertiser_reports').select('*').eq('workspace_id', activeWorkspaceId).eq('client_id', clientId).eq('report_date', reportDate).order('session', { ascending: true });
  let { data, error } = await q().eq('store_label', storeLabel);
  if (error && /store_label/.test(error.message)) ({ data, error } = await q());

  if (error) {
    console.error('Error fetching log detail:', error);
    return { data: [] as any[] };
  }

  const userIds = [...new Set((data || []).filter((d: any) => d.user_id).map((d: any) => d.user_id))];
  const names: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
    (profs || []).forEach((p: any) => {
      names[p.id] = p.full_name || p.email;
    });
  }

  return {
    data: (data || []).map((row: any) => ({ ...row, advertiser_name: names[row.user_id] || 'Unknown' })),
  };
}

/**
 * The session right before this one for the same client: the latest earlier session on the same day,
 * otherwise the last session of an earlier day (e.g. 1 Oct sesi 1 -> 30 Sep sesi 2 or 3).
 */
export async function fetchPreviousSession(clientId: string, reportDate: string, session: number, storeLabel = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !Number.isInteger(session)) return { data: null };

  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const q = () => supabase.from('advertiser_reports').select('session, report_date, data_inkubasi, data_group, data_mandiri').eq('workspace_id', activeWorkspaceId).eq('client_id', clientId)
    .or(`report_date.lt.${reportDate},and(report_date.eq.${reportDate},session.lt.${session})`).order('report_date', { ascending: false }).order('session', { ascending: false }).limit(1);
  let { data, error } = await q().eq('store_label', storeLabel).maybeSingle();
  if (error && /store_label/.test(error.message)) ({ data, error } = await q().maybeSingle());

  if (error) {
    console.error('Error fetching previous session:', error);
    return { data: null };
  }
  return { data };
}

/** The Modal Harian and Target ROAS of every ad in every session of one store over a year (for the calendar chart of Advertiser > Performance). */
export async function fetchStoreCalendar(storeLabel: string, clientIds: string[], year: number): Promise<{ data: StoreCalendar | null; error?: string }> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { data: null, error: 'Bad year.' };
  const supabase = await createClient();
  await getAuthenticatedWorkspaceContext(supabase); // signed in only; the rows themselves are limited by the database rules
  const cols = 'client_id, report_date, session, data_inkubasi, data_group, data_mandiri';
  const base = () => supabase.from('advertiser_reports').select(cols).gte('report_date', `${year}-01-01`).lte('report_date', `${year}-12-31`).limit(20000);
  const reports: InputReport[] = [];
  const label = String(storeLabel || '').trim().replace(/[%_]/g, '');
  if (label) {
    const { data, error } = await base().ilike('store_label', label);
    if (!error) reports.push(...((data || []) as any[]));
  }
  const ids = (clientIds || []).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length) {
    let { data, error } = await base().in('client_id', ids).is('store_label', null);
    if (error) ({ data, error } = await base().in('client_id', ids));
    if (!error) reports.push(...((data || []) as any[]));
  }
  return { data: calendarFromReports(reports) };
}

/**
 * Delete the log of one store on one day (every session), or just one session. The advertiser who handles the client may do it, and
 * Accounting, Admin, Superadmin and Founder. The database only lets owners delete, so the check is made here and the delete runs with the service role.
 */
export async function deleteAdvertiserLog(clientId: string, reportDate: string, storeLabel = '', session?: number): Promise<{ success: boolean; deleted?: number; error?: string }> {
  try {
    if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return { success: false, error: 'Nothing to delete.' };
    if (session !== undefined && ![1, 2, 3].includes(session)) return { success: false, error: 'Unknown session.' };
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Sign in again.' };
    const db = createAdminClient();

    if (!FINANCE_ROLES.includes(ctx.role)) {
      if (ctx.role !== 'advertiser') return { success: false, error: 'You cannot delete logs.' };
      const { data: mine } = await db.from('client_assignments').select('client_id').eq('client_id', clientId).eq('user_id', ctx.userId).eq('job', 'advertising').limit(1);
      if (!mine?.length) return { success: false, error: 'This client is not assigned to you.' };
    }

    const del = (withStore: boolean) => {
      let q = db.from('advertiser_reports').delete({ count: 'exact' }).eq('workspace_id', ctx.activeWorkspaceId).eq('client_id', clientId).eq('report_date', reportDate);
      if (withStore) q = q.eq('store_label', storeLabel);
      if (session !== undefined) q = q.eq('session', session);
      return q;
    };
    let { error, count } = await del(true);
    if (error && /store_label/.test(error.message)) ({ error, count } = await del(false)); // before 20261105_advertiser_report_store.sql
    if (error) return { success: false, error: error.message };
    return { success: true, deleted: count || 0 };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not delete the log.' };
  }
}
