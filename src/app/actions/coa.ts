'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface COAAccount {
  id?: string;
  account_code: string;
  account_name: string;
  account_type: string;
  description: string | null;
  is_active: boolean;
}

export async function upsertCOAAccount(account: COAAccount) {
  const supabase = await createClient();

  // Basic validation
  if (!account.account_code || !account.account_name || !account.account_type) {
    throw new Error('Account code, name, and type are required');
  }

  let error;

  if (account.id) {
    // Update existing
    const { error: updateError } = await supabase
      .from('global_chart_of_accounts')
      .update({
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        description: account.description,
        is_active: account.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);
    
    error = updateError;
  } else {
    // Insert new
    const { error: insertError } = await supabase
      .from('global_chart_of_accounts')
      .insert({
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        description: account.description,
        is_active: account.is_active !== undefined ? account.is_active : true,
      });

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

  const { error } = await supabase
    .from('global_chart_of_accounts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting COA:', error);
    throw new Error('Failed to delete Chart of Accounts entry.');
  }

  revalidatePath('/settings/coa');
  return { success: true };
}
