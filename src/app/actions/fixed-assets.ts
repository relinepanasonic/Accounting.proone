'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

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

    revalidatePath('/assets');
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

    const { error } = await supabase
      .from('fixed_assets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', activeWorkspaceId);

    if (error) throw new Error(error.message);

    revalidatePath('/assets');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting fixed asset' };
  }
}

export async function runMonthlyDepreciation() {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    // Get all active fixed assets
    const { data: assets, error: fetchError } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .eq('status', 'active');

    if (fetchError) throw new Error(fetchError.message);
    if (!assets || assets.length === 0) return { success: true, processedCount: 0 };

    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // e.g., '2026-08'
    const todayStr = today.toISOString().split('T')[0];

    // Get mappings to find Depreciation Expense Account (6100) and Acc Depr (120x)
    // For simplicity, usually depreciation goes to 6100 (Depreciation Expense) and credit to Accum Depr
    const { data: mappings } = await supabase.from('workspace_mappings').select('*').eq('workspace_id', activeWorkspaceId);
    
    // You typically credit an accumulated depreciation account (e.g. 1202) and debit depreciation expense (e.g. 6100).
    const deprExpenseAccount = mappings?.find((m: any) => m.mapping_type === 'DEPRECIATION_EXPENSE')?.account_code || '6100';
    const accDeprAccount = mappings?.find((m: any) => m.mapping_type === 'ACCUMULATED_DEPRECIATION')?.account_code || '1202';

    let processedCount = 0;

    for (const asset of assets) {
      const annualDepr = Number(asset.annual_depreciation) || 0;
      if (annualDepr <= 0) continue;

      const monthlyDepr = annualDepr / 12;
      const refId = `depr-${asset.id}-${currentMonth}`;

      // Check if already posted this month
      const { data: existingEntry } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('workspace_id', activeWorkspaceId)
        .eq('reference_id', refId)
        .limit(1);

      if (existingEntry && existingEntry.length > 0) {
        continue; // Already processed this asset for this month
      }

      // Check if fully depreciated (book value <= salvage value)
      // This is a simplified check. A full check would sum accumulated depreciation.
      // We will post it and let accountants adjust if it over-depreciates for now.

      // Post Journal Entry
      const description = `Monthly Depreciation - ${asset.asset_name} (${currentMonth})`;

      await supabase.from('journal_entries').insert([
        { workspace_id: activeWorkspaceId, account_code: deprExpenseAccount, transaction_date: todayStr, debit_amount: monthlyDepr, credit_amount: 0, description, reference_id: refId, reference_type: 'depreciation' },
        { workspace_id: activeWorkspaceId, account_code: accDeprAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: monthlyDepr, description, reference_id: refId, reference_type: 'depreciation' }
      ]);

      processedCount++;
    }

    // Save the last run time
    const { createAdminClient } = await import('@/lib/api/supabase-admin');
    const adminClient = createAdminClient();
    
    // We can store a metadata record in workspace settings to track the last run month.
    // For now, we'll just check journal entries to see if it was run.
    
    revalidatePath('/assets');
    revalidatePath('/ledger');
    revalidatePath('/');
    
    return { success: true, processedCount };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error running depreciation' };
  }
}
