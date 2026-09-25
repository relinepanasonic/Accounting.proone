'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

export async function getShopeeReports(days = 7) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Generate an array of dates for the last 'days' days
  const dates = Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  });

  const { data, error } = await supabase
    .from('admin_shopee_reports')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .in('report_date', dates);

  if (error) {
    // If the table doesn't exist, we return a mock format or empty list, it's fine.
    console.error('Error fetching shopee reports (table might not exist yet):', error.message);
    return dates.map(d => ({ report_date: d, is_uploaded: false }));
  }

  // Merge the fetched data with the last 7 days so we always have a row for each date
  const result = dates.map(dateStr => {
    const existing = data?.find(r => r.report_date === dateStr);
    return existing || { report_date: dateStr, is_uploaded: false };
  });

  return result;
}

export async function toggleShopeeReportUpload(reportDate: string, isUploaded: boolean) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { error } = await supabase
    .from('admin_shopee_reports')
    .upsert({
      workspace_id: activeWorkspaceId,
      report_date: reportDate,
      is_uploaded: isUploaded,
      uploaded_at: isUploaded ? new Date().toISOString() : null,
    }, { onConflict: 'workspace_id, report_date' });

  if (error) {
    console.error('Error upserting shopee report:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/productivity/admin');
  return { success: true };
}
