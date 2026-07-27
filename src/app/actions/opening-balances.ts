'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export async function saveBankOpeningBalances(formData: FormData) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.activeWorkspaceId) {
    throw new Error('Unauthorized');
  }

  const bankName = formData.get('bankName') as string;
  const balance = Number(formData.get('balance'));
  const date = formData.get('date') as string; // typically YYYY-MM-DD

  if (!bankName || isNaN(balance) || !date) {
    throw new Error('Invalid input');
  }

  // Create a double-entry Journal Entry for Saldo Awal Kas/Bank
  const { data: journal, error: journalError } = await supabase
    .from('journal_entries')
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      entry_number: `OB-${Date.now()}`,
      entry_date: date,
      description: `Opening Balance (Saldo Awal) - ${bankName}`,
      source_document_id: null,
      source_module: 'opening_balance'
    })
    .select('id')
    .single();

  if (journalError || !journal) {
    console.error('Error creating journal:', journalError);
    throw new Error('Failed to create opening balance journal');
  }

  // Insert lines: Debit Bank, Credit Retained Earnings
  const lines = [
    {
      workspace_id: ctx.activeWorkspaceId,
      journal_entry_id: journal.id,
      account_name: bankName,
      account_type: 'asset',
      debit_amount: balance,
      credit_amount: 0,
      description: 'Opening Cash Balance'
    },
    {
      workspace_id: ctx.activeWorkspaceId,
      journal_entry_id: journal.id,
      account_name: 'Retained Earnings',
      account_type: 'equity',
      debit_amount: 0,
      credit_amount: balance,
      description: 'Historical Balancing Account'
    }
  ];

  const { error: linesError } = await supabase
    .from('journal_entry_lines')
    .insert(lines);

  if (linesError) {
    console.error('Error creating journal lines:', linesError);
    // Ideally rollback, but for now just throw
    throw new Error('Failed to create opening balance lines');
  }

  revalidatePath('/settings/opening-balances');
  revalidatePath('/ledger');
}

export interface AdvancedJournalPayload {
  entryDate: string;
  description: string;
  lines: Array<{
    accountName: string;
    accountType: string;
    debit: number;
    credit: number;
  }>;
}

export async function saveAdvancedJournal(payload: AdvancedJournalPayload) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.activeWorkspaceId) {
    throw new Error('Unauthorized');
  }

  // Validate balance
  const totalDebit = payload.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = payload.lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit <= 0) {
    throw new Error('Journal entry must be balanced and greater than zero.');
  }

  const { data: journal, error: journalError } = await supabase
    .from('journal_entries')
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      entry_number: `OB-ADV-${Date.now()}`,
      entry_date: payload.entryDate,
      description: payload.description,
      source_document_id: null,
      source_module: 'opening_balance_advanced'
    })
    .select('id')
    .single();

  if (journalError || !journal) {
    console.error('Error creating journal:', journalError);
    throw new Error('Failed to create advanced journal');
  }

  const dbLines = payload.lines.map(l => ({
    workspace_id: ctx.activeWorkspaceId,
    journal_entry_id: journal.id,
    account_name: l.accountName,
    account_type: l.accountType,
    debit_amount: l.debit,
    credit_amount: l.credit,
    description: payload.description
  }));

  const { error: linesError } = await supabase
    .from('journal_entry_lines')
    .insert(dbLines);

  if (linesError) {
    console.error('Error creating journal lines:', linesError);
    throw new Error('Failed to create advanced journal lines');
  }

  revalidatePath('/settings/opening-balances');
  revalidatePath('/ledger');
}
