'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

export async function getSalesDashboardStats() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: deals, error } = await supabase
    .from('crm_deals')
    .select('id, client_id, value, stage, salesman_name, clients(name)')
    .eq('workspace_id', activeWorkspaceId);

  if (error) throw new Error(error.message);

  let totalPipelineValue = 0;
  let wonDealsCount = 0;
  let totalWonValue = 0;

  const clientStats: Record<string, { name: string, pipeline: number, won: number }> = {};
  const salesmanStats: Record<string, { pipeline: number, wonCount: number, wonValue: number, lostCount: number }> = {};

  (deals || []).forEach(deal => {
    const val = Number(deal.value || 0);
    const cname = deal.clients?.name || 'Unknown Client';
    const sname = deal.salesman_name || 'Unassigned';

    if (!clientStats[deal.client_id]) clientStats[deal.client_id] = { name: cname, pipeline: 0, won: 0 };
    if (!salesmanStats[sname]) salesmanStats[sname] = { pipeline: 0, wonCount: 0, wonValue: 0, lostCount: 0 };

    if (deal.stage === 'Deal' || deal.stage === 'Won') {
      wonDealsCount++;
      totalWonValue += val;
      clientStats[deal.client_id].won += val;
      salesmanStats[sname].wonCount++;
      salesmanStats[sname].wonValue += val;
    } else if (deal.stage === 'Lost') {
      salesmanStats[sname].lostCount++;
    } else {
      totalPipelineValue += val;
      clientStats[deal.client_id].pipeline += val;
      salesmanStats[sname].pipeline += val;
    }
  });

  return {
    totalPipelineValue,
    wonDealsCount,
    totalWonValue,
    clientStats: Object.values(clientStats).sort((a, b) => (b.won + b.pipeline) - (a.won + a.pipeline)),
    salesmanStats: Object.entries(salesmanStats).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.wonValue - a.wonValue)
  };
}

export async function getPipelineDeals(month?: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // If no month is provided, fallback to current month
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  // Fetch deals for the target month
  const { data: deals, error } = await supabase
    .from('crm_deals')
    .select('*, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .eq('pipeline_month', targetMonth)
    .neq('stage', 'Lead') // don't show raw leads in pipeline
    .order('created_at', { ascending: false });

  if (error) {
    // If column doesn't exist yet, fallback to fetching all active deals (ignores month filtering temporarily)
    if (error.message.includes('pipeline_month')) {
      const { data: fallbackDeals } = await supabase
        .from('crm_deals')
        .select('*, clients(name)')
        .eq('workspace_id', activeWorkspaceId)
        .neq('stage', 'Lead')
        .order('created_at', { ascending: false });
      return fallbackDeals || [];
    }
    throw new Error(error.message);
  }

  // Monthly Roll-over Logic:
  // If no deals exist for the target month, check if there are deals from the previous month
  if (deals && deals.length === 0) {
    const [yearStr, monthStr] = targetMonth.split('-');
    const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    dateObj.setMonth(dateObj.getMonth() - 1);
    const prevMonth = dateObj.toISOString().slice(0, 7);

    const { data: prevDeals } = await supabase
      .from('crm_deals')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .eq('pipeline_month', prevMonth)
      .neq('stage', 'Deal') // Don't roll over Won deals
      .neq('stage', 'Lost'); // Don't roll over Lost deals

    if (prevDeals && prevDeals.length > 0) {
      // Duplicate them for the new month
      const newDeals = prevDeals.map(d => {
        const { id, created_at, updated_at, ...rest } = d;
        return {
          ...rest,
          pipeline_month: targetMonth
        };
      });

      await supabase.from('crm_deals').insert(newDeals);

      // Fetch again to get the new IDs and client names joined
      const { data: freshDeals } = await supabase
        .from('crm_deals')
        .select('*, clients(name)')
        .eq('workspace_id', activeWorkspaceId)
        .eq('pipeline_month', targetMonth)
        .neq('stage', 'Lead')
        .order('created_at', { ascending: false });
        
      return freshDeals || [];
    }
  }

  return deals || [];
}

export async function updateDealStage(dealId: string, newStage: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('crm_deals')
    .update({ stage: newStage })
    .eq('id', dealId);

  if (error) throw new Error(error.message);
  revalidatePath('/sales/pipeline');
  revalidatePath('/sales');
  revalidatePath('/sales/leads');
}

export async function createDeal(formData: FormData) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const clientId = formData.get('client_id') as string;
  const title = formData.get('title') as string;
  const value = formData.get('value') as string;
  const salesman = formData.get('salesman_name') as string;
  const expectedDate = formData.get('expected_close_date') as string;
  const notes = formData.get('notes') as string;
  const stage = formData.get('stage') as string || 'Lead';
  
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { error } = await supabase.from('crm_deals').insert({
    workspace_id: activeWorkspaceId,
    client_id: clientId,
    title,
    value: value ? parseFloat(value.replace(/,/g, '')) : 0,
    salesman_name: salesman || null,
    expected_close_date: expectedDate || null,
    notes: notes || null,
    stage,
    pipeline_month: currentMonth
  });

  if (error) {
    if (error.message.includes('pipeline_month')) {
      // Fallback if migration hasn't run
      await supabase.from('crm_deals').insert({
        workspace_id: activeWorkspaceId,
        client_id: clientId,
        title,
        value: value ? parseFloat(value.replace(/,/g, '')) : 0,
        salesman_name: salesman || null,
        expected_close_date: expectedDate || null,
        notes: notes || null,
        stage
      });
    } else {
      throw new Error(error.message);
    }
  }
  
  revalidatePath('/sales/pipeline');
  revalidatePath('/sales/leads');
  revalidatePath('/sales');
}
