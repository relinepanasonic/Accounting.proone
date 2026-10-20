'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

export interface JournalEntry {
  id: string;
  workspace_id: string;
  account_code: string;
  transaction_date: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
  reference_id: string;
  reference_type: string;
  created_at: string;
}

export async function getJournalEntriesForAccount(accountCode: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .eq('account_code', accountCode)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching journal entries:', error);
    return [];
  }

  return data as JournalEntry[];
}
