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
      created_at,
      user_id,
      clients ( name ),
      users ( email )
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
  note: string | null
) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('advertiser_reports')
    .upsert({
      workspace_id: activeWorkspaceId,
      client_id: clientId,
      report_date: reportDate,
      session,
      data_inkubasi,
      data_group,
      data_mandiri,
      screenshot_url: screenshotUrl,
      user_id: userData?.user?.id,
      note
    }, {
      onConflict: 'client_id, report_date, session'
    });

  if (error) {
    console.error('Error saving advertiser report:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
