'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

export async function getSalesDashboardStats() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: deals, error } = await supabase
    .from('crm_deals')
    .select('id, client_id, lead_name, value, stage, salesman_name, clients(name)')
    .eq('workspace_id', activeWorkspaceId);

  if (error) throw new Error(error.message);

  let totalPipelineValue = 0;
  let wonDealsCount = 0;
  let totalWonValue = 0;

  const clientStats: Record<string, { name: string, pipeline: number, won: number }> = {};
  const salesmanStats: Record<string, { pipeline: number, wonCount: number, wonValue: number, lostCount: number }> = {};

  (deals || []).forEach(deal => {
    const val = Number(deal.value || 0);
    const cname = deal.clients?.name || deal.lead_name || 'Unknown Client';
    const sname = deal.salesman_name || 'Unassigned';
    
    const statKey = deal.client_id || deal.lead_name || 'unknown';

    if (!clientStats[statKey]) clientStats[statKey] = { name: cname, pipeline: 0, won: 0 };
    if (!salesmanStats[sname]) salesmanStats[sname] = { pipeline: 0, wonCount: 0, wonValue: 0, lostCount: 0 };

    if (deal.stage === 'Deal' || deal.stage === 'Won') {
      wonDealsCount++;
      totalWonValue += val;
      clientStats[statKey].won += val;
      salesmanStats[sname].wonCount++;
      salesmanStats[sname].wonValue += val;
    } else if (deal.stage === 'Lost') {
      salesmanStats[sname].lostCount++;
    } else {
      totalPipelineValue += val;
      clientStats[statKey].pipeline += val;
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

  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const { data: deals, error } = await supabase
    .from('crm_deals')
    .select('*, clients(name)')
    .eq('workspace_id', activeWorkspaceId)
    .eq('pipeline_month', targetMonth)
    .neq('stage', 'Lead')
    .order('created_at', { ascending: false });

  if (error) {
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
      .neq('stage', 'Deal')
      .neq('stage', 'Lost');

    if (prevDeals && prevDeals.length > 0) {
      const newDeals = prevDeals.map(d => {
        const { id, created_at, updated_at, ...rest } = d;
        return {
          ...rest,
          pipeline_month: targetMonth
        };
      });

      await supabase.from('crm_deals').insert(newDeals);

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
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Check if we are moving to Invoice or Deal and it's a new lead (no client_id)
  if (newStage === 'Invoice' || newStage === 'Deal') {
    const { data: deal } = await supabase.from('crm_deals').select('client_id, lead_name').eq('id', dealId).single();
    
    if (deal && !deal.client_id && deal.lead_name) {
      // Create new client automatically for Accounting
      const { data: newClient } = await supabase
        .from('clients')
        .insert({ name: deal.lead_name, workspace_id: activeWorkspaceId })
        .select('id')
        .single();
        
      if (newClient) {
        const { error } = await supabase
          .from('crm_deals')
          .update({ stage: newStage, client_id: newClient.id })
          .eq('id', dealId);
        if (error) throw new Error(error.message);
        
        revalidatePath('/sales/pipeline');
        revalidatePath('/sales/leads');
        revalidatePath('/sales');
        return;
      }
    }
  }

  // Standard update
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
  const leadName = formData.get('lead_name') as string;
  const title = formData.get('title') as string;
  const value = formData.get('value') as string;
  const salesman = formData.get('salesman_name') as string;
  const expectedDate = formData.get('expected_close_date') as string;
  const notes = formData.get('notes') as string;
  const stage = formData.get('stage') as string || 'Lead';
  
  const currentMonth = new Date().toISOString().slice(0, 7);

  const payload: any = {
    workspace_id: activeWorkspaceId,
    title,
    value: value ? parseFloat(value.replace(/,/g, '')) : 0,
    salesman_name: salesman || null,
    expected_close_date: expectedDate || null,
    notes: notes || null,
    stage,
    pipeline_month: currentMonth
  };

  if (clientId) payload.client_id = clientId;
  if (leadName) payload.lead_name = leadName;

  const { error } = await supabase.from('crm_deals').insert(payload);

  if (error) {
    if (error.message.includes('pipeline_month')) {
      // Fallback
      delete payload.pipeline_month;
      await supabase.from('crm_deals').insert(payload);
    } else {
      throw new Error(error.message);
    }
  }
  
  revalidatePath('/sales/pipeline');
  revalidatePath('/sales/leads');
  revalidatePath('/sales');
}
