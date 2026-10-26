'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';
import { syncAssetSchedules } from '@/lib/assets/sync';
import { monthsOf } from '@/lib/assets/schedule';
import { previewRebuild, rebuildSchedule, describePlan } from '@/lib/assets/rebuild';

/** Adds an asset by hand: its Schedule Expense is made at once (the months already past are posted). The bank payment is matched later in Bank Reconcile > Cash Paid. */
export async function createFixedAsset(payload: { asset_name: string; category: string; purchase_date: string; initial_value: number; salvage_value: number; months: number }) {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!['founder', 'superadmin', 'accounting'].includes(ctx.role)) return { success: false, error: 'Only the Founder, a Superadmin or Accounting can add an asset.' };
    const name = String(payload.asset_name || '').trim();
    const cost = Number(payload.initial_value);
    const salvage = Number(payload.salvage_value || 0);
    const months = Math.round(Number(payload.months));
    if (!name) return { success: false, error: 'The asset name is required.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.purchase_date))) return { success: false, error: 'Check the purchase date.' };
    if (!(cost > 0)) return { success: false, error: 'The purchase cost must be more than 0.' };
    if (salvage < 0 || salvage >= cost) return { success: false, error: 'The salvage value must be less than the cost.' };
    if (!(months >= 1)) return { success: false, error: 'The months must be at least 1.' };

    const { data: asset, error } = await supabase.from('fixed_assets').insert({
      workspace_id: ctx.activeWorkspaceId,
      asset_name: name,
      category: payload.category,
      purchase_date: payload.purchase_date,
      initial_value: cost,
      salvage_value: salvage,
      useful_life_years: months / 12,
      // annual_depreciation is a generated column: not passed
      status: 'active',
    }).select('id').single();
    if (error || !asset) return { success: false, error: error?.message || 'Could not save the asset.' };

    const sync = await syncAssetSchedules(supabase, { workspaceId: ctx.activeWorkspaceId, assetId: asset.id });
    revalidatePath('/assets');
    revalidatePath('/assets/schedule');
    revalidatePath('/expenses');
    revalidatePath('/reconcile');
    if (!sync.ok) return { success: true, id: asset.id, error: sync.error };
    return { success: true, id: asset.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not add the asset.' };
  }
}

/**
 * Saves an edited asset. When the months or the salvage value change, the whole Schedule Expense is rebuilt from the purchase day
 * (posted months get the new amount, months beyond the new life leave the ledger). That rewrites closed months, so the first call
 * answers { needsConfirm, summary } and nothing is saved until it is called again with confirm = true.
 */
export async function updateFixedAsset(id: string, payload: any, opts: { confirm?: boolean } = {}) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { createAdminClient } = await import('@/lib/api/supabase-admin');
    const admin = createAdminClient();
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

    const { data: asset } = await supabase.from('fixed_assets').select('id, workspace_id, asset_name, initial_value, salvage_value, purchase_date, created_at, useful_life_years').eq('id', id).eq('workspace_id', activeWorkspaceId).single();
    if (!asset) throw new Error('Asset not found.');

    const months = monthsOf(payload.useful_life_years);
    const salvage = Number(payload.salvage_value || 0);
    const scheduleChanged = months !== monthsOf(asset.useful_life_years) || Math.abs(salvage - Number(asset.salvage_value || 0)) > 0.005;

    if (scheduleChanged && !opts.confirm) {
      const plan = await previewRebuild(admin, asset as any, months, salvage, today);
      if (plan.changes) return { success: false, needsConfirm: true, summary: describePlan(plan), error: undefined as string | undefined };
    }

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

    if (scheduleChanged) {
      const res = await rebuildSchedule(admin, { ...(asset as any), asset_name: payload.asset_name || asset.asset_name }, months, salvage, today);
      if (!res.ok) throw new Error(res.error || 'The asset was saved but its schedule could not be rebuilt.');
    } else {
      await syncAssetSchedules(supabase, { workspaceId: activeWorkspaceId, assetId: id });
    }

    revalidatePath('/assets');
    revalidatePath('/assets/schedule');
    revalidatePath('/expenses');
    revalidatePath('/ledger');
    revalidatePath('/');
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

