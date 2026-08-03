'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export interface LedgerMapping {
  id?: string;
  workspace_id: string;
  mapping_type: 'AR' | 'SALES' | 'AP' | 'EXPENSE';
  account_code: string;
}

export async function getWorkspaceMappings(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspace_ledger_mappings')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error fetching mappings:', error);
    return [];
  }
  return data as LedgerMapping[];
}

export async function saveWorkspaceMapping(workspaceId: string, mappingType: 'AR' | 'SALES' | 'AP' | 'EXPENSE', accountCode: string) {
  const supabase = await createClient();
  
  // Upsert the mapping (we use unique constraint on workspace_id + mapping_type)
  const { error } = await supabase
    .from('workspace_ledger_mappings')
    .upsert(
      {
        workspace_id: workspaceId,
        mapping_type: mappingType,
        account_code: accountCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id, mapping_type' }
    );

  if (error) {
    console.error('Failed to save mapping:', error);
    throw new Error('Failed to save ledger mapping.');
  }

  revalidatePath('/settings/coa');
  return { success: true };
}
