'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export async function fetchAdvertiserLogs() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch all reports to group them
  const { data, error } = await supabase
    .from('advertiser_reports')
    .select(`
      id,
      client_id,
      report_date,
      session,
      note,
      data_inkubasi,
      created_at,
      user_id,
      clients ( name )
    `)
    .eq('workspace_id', activeWorkspaceId)
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching logs:', error);
    return { data: [] };
  }

  // Need to get user names from workspace_members or profiles
  // Since we don't easily have a direct link to profiles from advertiser_reports,
  // we will just fetch profiles separately for the user_ids found
  const userIds = [...new Set(data.filter(d => d.user_id).map(d => d.user_id))];
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

  // Group by client_id + report_date
  // We want to show 1 row per (client, date) and show checkboxes for session 1, 2, 3
  const grouped: Record<string, any> = {};

  data.forEach((row: any) => {
    const key = `${row.client_id}_${row.report_date}`;
    if (!grouped[key]) {
      grouped[key] = {
        client_id: row.client_id,
        client_name: row.clients?.name || 'Unknown',
        report_date: row.report_date,
        advertiser_name: profiles[row.user_id] || 'Unknown',
        note: row.note || '',
        recommendation: '',
        created_at: row.created_at,
        sessions: { 1: false, 2: false, 3: false }
      };
    }
    grouped[key].sessions[row.session as 1|2|3] = true;
    
    // Prefer earliest creation date for the Date Stamp
    if (new Date(row.created_at) < new Date(grouped[key].created_at)) {
      grouped[key].created_at = row.created_at;
    }
    // Prefer most recent note
    if (row.note && !grouped[key].note) {
      grouped[key].note = row.note;
    }

    // Evaluate Recommendation based on Inkubasi
    if (row.data_inkubasi && Array.isArray(row.data_inkubasi)) {
      const needsAction = row.data_inkubasi.some((r: any) => {
        const modal = parseFloat(r.modalHarian?.replace(/,/g, '') || '0');
        const biaya = parseFloat(r.biayaIklan?.replace(/,/g, '') || '0');
        return modal > 0 && biaya > (0.8 * modal);
      });
      if (needsAction) {
        grouped[key].recommendation = "Check Detail Produk, Pindahkan Iklan yang boros ke Iklan Group";
      }
    }
  });

  return { data: Object.values(grouped).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) };
}

export async function fetchAdvertiserReport(clientId: string, reportDate: string, session: number) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Try to find the exact report
  const { data: exactReport, error: exactError } = await supabase
    .from('advertiser_reports')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .eq('client_id', clientId)
    .eq('report_date', reportDate)
    .eq('session', session)
    .single();

  if (exactReport && !exactError) {
    return { data: exactReport, isHistorical: false };
  }

  // If no exact report, find the most recent one for this client
  const { data: lastReport } = await supabase
    .from('advertiser_reports')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .eq('client_id', clientId)
    .order('report_date', { ascending: false })
    .order('session', { ascending: false })
    .limit(1)
    .single();

  if (lastReport) {
    return { data: lastReport, isHistorical: true };
  }

  return { data: null, isHistorical: false };
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
  sisaSaldo: string | null = null
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
  };

  let { error } = await supabase
    .from('advertiser_reports')
    .upsert({ ...base, sisa_saldo_iklan: sisaSaldo }, { onConflict: 'client_id, report_date, session' });

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
export async function fetchAdvertiserLogDetail(clientId: string, reportDate: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data, error } = await supabase
    .from('advertiser_reports')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .eq('client_id', clientId)
    .eq('report_date', reportDate)
    .order('session', { ascending: true });

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
export async function fetchPreviousSession(clientId: string, reportDate: string, session: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !Number.isInteger(session)) return { data: null };

  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data, error } = await supabase
    .from('advertiser_reports')
    .select('session, report_date, data_inkubasi, data_group, data_mandiri')
    .eq('workspace_id', activeWorkspaceId)
    .eq('client_id', clientId)
    .or(`report_date.lt.${reportDate},and(report_date.eq.${reportDate},session.lt.${session})`)
    .order('report_date', { ascending: false })
    .order('session', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching previous session:', error);
    return { data: null };
  }
  return { data };
}
