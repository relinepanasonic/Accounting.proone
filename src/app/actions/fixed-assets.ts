'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';
import { syncAssetSchedules } from '@/lib/assets/sync';

export async function updateFixedAsset(id: string, payload: any) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const { error } = await supabase
      .from('fixed_assets')
      .update({
        asset_name: payload.asset_name,
        category: payload.category,
        useful_life_years: payload.useful_life_years,
        salvage_value: payload.salvage_value,
        annual_depreciation: payload.annual_depreciation,
      })
      .eq('id', id)
      .eq('workspace_id', activeWorkspaceId);

    if (error) throw new Error(error.message);

    // The months, cost or salvage may have changed: the unposted payments of the Schedule Expense are spread again.
    await syncAssetSchedules(supabase, { workspaceId: activeWorkspaceId, assetId: id });

    revalidatePath('/assets');
    revalidatePath('/assets/schedule');
    revalidatePath(`/assets/${id}/edit`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error updating fixed asset' };
  }
}

export async function deleteFixedAsset(id: string) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    // 1. Get the fixed asset details before deleting to find the connected transaction
    const { data: asset } = await supabase.from('fixed_assets').select('*').eq('id', id).single();
    
    if (asset) {
      // 2. Try to find the matching transaction that created this asset
      const { data: txList } = await supabase.from('transactions')
        .select('id')
        .eq('workspace_id', activeWorkspaceId)
        .eq('amount', asset.initial_value)
        .eq('category', asset.category)
        .limit(1);
        
      if (txList && txList.length > 0) {
        // Use admin client to delete the original expense and its journal entries
        const { createAdminClient } = await import('@/lib/api/supabase-admin');
        const adminClient = createAdminClient();
        await adminClient.from('journal_entries').delete().eq('reference_id', txList[0].id);
        await adminClient.from('transactions').delete().eq('id', txList[0].id);
      }
    }

    {
      const { createAdminClient } = await import('@/lib/api/supabase-admin');
      await createAdminClient().from('journal_entries').delete().eq('reference_id', id).eq('reference_type', 'depreciation');
    }

    const { error } = await supabase
      .from('fixed_assets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', activeWorkspaceId);

    if (error) throw new Error(error.message);

    revalidatePath('/assets');
    revalidatePath('/expenses');
    revalidatePath('/ledger');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting fixed asset' };
  }
}

/**
 * Syncs the Schedule Expense of this company's assets: makes missing schedules, spreads edited ones again and posts every payment that is due.
 * Replaces the old month-end engine (one engine only, so nothing is posted twice).
 */
export async function runMonthlyDepreciation() {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const res = await syncAssetSchedules(supabase, { workspaceId: activeWorkspaceId });
    if (!res.ok) return { success: false, error: res.error || 'Could not sync the schedule.' };
    revalidatePath('/assets');
    revalidatePath('/assets/schedule');
    revalidatePath('/ledger');
    revalidatePath('/');
    return { success: true, processedCount: res.posted, created: res.created };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error syncing the schedule' };
  }
}

export async function getAssetDepreciationHistory(assetId: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // We look for journal entries related to this asset's depreciation
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, transaction_date, debit_amount, credit_amount, description, reference_id, reference_type')
    .eq('workspace_id', activeWorkspaceId)
    .eq('reference_id', assetId)
    .eq('reference_type', 'depreciation')
    .order('transaction_date', { ascending: false });

  if (error) {
    console.error('Error fetching depreciation history:', error);
    return [];
  }

  // Return only debit entries (the expense side) to avoid showing duplicates
  const debitEntries = (data || []).filter(e => Number(e.debit_amount) > 0);
  return debitEntries.length > 0 ? debitEntries : (data || []);
}

