'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';

/** Save the team's manual verdict on one invoice (or clear it with verdict = null). */
export async function saveLedgerCheck(invoiceId: string, verdict: 'ok' | 'problem' | null, note: string) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || !FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Only finance roles can mark invoices.' };

  const { data: inv } = await supabase.from('invoices').select('id').eq('id', invoiceId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!inv) return { success: false, error: 'Invoice not found in this workspace.' };

  const { error } = verdict
    ? await supabase.from('ledger_checks').upsert(
        {
          workspace_id: ctx.activeWorkspaceId,
          invoice_id: invoiceId,
          verdict,
          note: note.trim().slice(0, 1000) || null,
          checked_by: ctx.userId,
          checked_by_name: ctx.userName || ctx.userEmail || 'Unknown',
          checked_at: new Date().toISOString(),
        },
        { onConflict: 'invoice_id' }
      )
    : await supabase.from('ledger_checks').delete().eq('invoice_id', invoiceId).eq('workspace_id', ctx.activeWorkspaceId);

  if (error) {
    const missing = error.code === 'PGRST205' || error.code === '42P01';
    return { success: false, error: missing ? 'Run supabase/migrations/20261002_ledger_checks.sql in Supabase first.' : error.message };
  }
  revalidatePath('/ledger/check');
  return { success: true };
}
