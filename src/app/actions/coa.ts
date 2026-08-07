'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export interface COAAccount {
  id?: string;
  account_code: string;
  account_name: string;
  account_type: string;
  description: string | null;
  is_active: boolean;
  parent_code?: string | null;
  workspace_id?: string | null;
  balance?: number;
}

export async function upsertCOAAccount(account: COAAccount, cloneWorkspaceIds?: string[]) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Basic validation
  if (!account.account_code || !account.account_name || !account.account_type) {
    throw new Error('Account code, name, and type are required');
  }

  let error;

  if (account.id && (!cloneWorkspaceIds || cloneWorkspaceIds.length <= 1)) {
    // Update existing single account
    const { error: updateError } = await supabase
      .from('global_chart_of_accounts')
      .update({
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        description: account.description,
        is_active: account.is_active,
        parent_code: account.parent_code || null,
        workspace_id: account.workspace_id !== undefined ? account.workspace_id : activeWorkspaceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
      .eq('workspace_id', activeWorkspaceId);
    
    error = updateError;
  } else {
    // Insert new (single or cloned)
    const targets = cloneWorkspaceIds && cloneWorkspaceIds.length > 0 ? cloneWorkspaceIds : [account.workspace_id !== undefined ? account.workspace_id : activeWorkspaceId];
    
    const insertPayload = targets.map(targetId => ({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      description: account.description,
      parent_code: account.parent_code || null,
      workspace_id: targetId || null,
      is_active: account.is_active !== undefined ? account.is_active : true,
    }));

    const { error: insertError } = await supabase
      .from('global_chart_of_accounts')
      .insert(insertPayload);

    error = insertError;
  }

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Account code ${account.account_code} already exists.`);
    }
    console.error('Error upserting COA:', error);
    throw new Error('Failed to save Chart of Accounts entry.');
  }

  revalidatePath('/settings/coa');
  return { success: true };
}

export async function deleteCOAAccount(id: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { error } = await supabase
    .from('global_chart_of_accounts')
    .delete()
    .eq('id', id)
    .eq('workspace_id', activeWorkspaceId);

  if (error) {
    console.error('Error deleting COA:', error);
    throw new Error('Failed to delete Chart of Accounts entry.');
  }

  revalidatePath('/settings/coa');
  return { success: true };
}
