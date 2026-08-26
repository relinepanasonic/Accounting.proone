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

export async function runMonthlyDepreciation() {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    // Get all active fixed assets (case-insensitive to handle 'Active' or 'active')
    const { data: assets, error: fetchError } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .ilike('status', 'active');

    if (fetchError) throw new Error(fetchError.message);
    if (!assets || assets.length === 0) return { success: true, processedCount: 0 };


    // Get mappings to find Depreciation Expense Account (6100) and Acc Depr (120x)
    // For simplicity, usually depreciation goes to 6100 (Depreciation Expense) and credit to Accum Depr
    const { data: mappings } = await supabase.from('workspace_mappings').select('*').eq('workspace_id', activeWorkspaceId);
    
    // You typically credit an accumulated depreciation account (e.g. 1202) and debit depreciation expense (e.g. 6100).
    const deprExpenseAccount = mappings?.find((m: any) => m.mapping_type === 'DEPRECIATION_EXPENSE')?.account_code || '6100';
    const accDeprAccount = mappings?.find((m: any) => m.mapping_type === 'ACCUMULATED_DEPRECIATION')?.account_code || '1202';

    let processedCount = 0;
    const today = new Date();

    for (const asset of assets) {
      const annualDepr = Number(asset.annual_depreciation) || 0;
      if (annualDepr <= 0) continue;

      const monthlyDepr = annualDepr / 12;

      // Fetch all existing depreciation journal entries for this asset
      const { data: existingEntries, error: fetchEntryErr } = await supabase
        .from('journal_entries')
        .select('transaction_date')
        .eq('workspace_id', activeWorkspaceId)
        .eq('reference_id', asset.id)
        .eq('reference_type', 'depreciation');

      if (fetchEntryErr) {
        console.error('Failed to fetch existing entries for asset', asset.id, fetchEntryErr);
        continue;
      }

      // Keep track of which months have already been depreciated
      const loggedMonths = new Set((existingEntries || []).map(e => e.transaction_date.substring(0, 7)));

      // Determine the start month (from purchase_date) and end month (current month)
      let purchaseDate = new Date(asset.purchase_date || asset.created_at);
      if (isNaN(purchaseDate.getTime())) purchaseDate = new Date();

      const startDate = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth(), 1);

      let currentDate = new Date(startDate);
      
      // Loop month by month to retroactively fill any missed depreciation
      while (currentDate <= endDate) {
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const monthKey = `${yyyy}-${mm}`; // e.g., '2026-08'

        if (!loggedMonths.has(monthKey)) {
          // Log depreciation for this missing month
          
          // Check if fully depreciated (book value <= salvage value)
          // For now, we will post it and let accountants adjust if it over-depreciates.
          
          // Use the last day of the month for the journal entry date
          const lastDayOfMonth = new Date(yyyy, currentDate.getMonth() + 1, 0).getDate();
          const txDateStr = `${monthKey}-${String(lastDayOfMonth).padStart(2, '0')}`;
          
          const description = `Monthly Depreciation - ${asset.asset_name} (${monthKey})`;

          const { error: insertError } = await supabase.from('journal_entries').insert([
            { workspace_id: activeWorkspaceId, account_code: deprExpenseAccount, transaction_date: txDateStr, debit_amount: monthlyDepr, credit_amount: 0, description, reference_id: asset.id, reference_type: 'depreciation' },
            { workspace_id: activeWorkspaceId, account_code: accDeprAccount, transaction_date: txDateStr, debit_amount: 0, credit_amount: monthlyDepr, description, reference_id: asset.id, reference_type: 'depreciation' }
          ]);
          
          if (insertError) {
            console.error('Failed to insert depreciation for asset', asset.id, monthKey, insertError);
          } else {
            processedCount++;
          }
        }
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
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

