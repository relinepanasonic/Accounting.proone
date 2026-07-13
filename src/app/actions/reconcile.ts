'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function reconcileRecord(
  recordId: string,
  recordType: 'invoice' | 'expense',
  bankReference: string
) {
  const supabase = await createClient();
  const table = recordType === 'invoice' ? 'invoices' : 'transactions';

  const { error } = await supabase
    .from(table)
    .update({
      reconciled: true,
      bank_reference: bankReference || 'BANK-MATCHED',
    })
    .eq('id', recordId);

  if (error) {
    console.error('Error reconciling record:', error);
    throw new Error('Failed to reconcile record');
  }

  revalidatePath('/reconcile');
  revalidatePath('/invoices');
  revalidatePath('/expenses');
  revalidatePath('/');
  return { success: true };
}
