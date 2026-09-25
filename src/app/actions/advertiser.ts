'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

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
  screenshotUrl: string | null
) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

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
      screenshot_url: screenshotUrl
    }, {
      onConflict: 'client_id, report_date, session'
    });

  if (error) {
    console.error('Error saving advertiser report:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
