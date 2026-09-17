'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

export async function getSalesDashboardStats() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Fetch all deals for this workspace to aggregate
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

    // Initialize stats
    if (!clientStats[deal.client_id]) clientStats[deal.client_id] = { name: cname, pipeline: 0, won: 0 };
    if (!salesmanStats[sname]) salesmanStats[sname] = { pipeline: 0, wonCount: 0, wonValue: 0, lostCount: 0 };

    if (deal.stage === 'Won') {
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

export async function getPipelineDeals() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data, error } = await supabase
    .from('crm_deals')
    .select('*, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
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

  const { error } = await supabase.from('crm_deals').insert({
    workspace_id: activeWorkspaceId,
    client_id: clientId,
    title,
    value: value ? parseFloat(value.replace(/,/g, '')) : 0,
    salesman_name: salesman || null,
    expected_close_date: expectedDate || null,
    notes: notes || null,
    stage
  });

  if (error) throw new Error(error.message);
  revalidatePath('/sales/pipeline');
  revalidatePath('/sales');
}
