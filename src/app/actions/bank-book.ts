'use server';

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';

export interface BankBookLineInput {
  date: string;
  sourceDestination: string;
  transactionDetails: string;
  notes: string;
  rekFrom: string;
  amount: number;
}

/**
 * Buku Bank: keep every line of an uploaded statement. Lines already stored (same bank account, date, amount, text) are skipped,
 * so uploading an overlapping statement again never doubles anything. Needs supabase/migrations/20261014_bank_book.sql.
 */
export async function saveBankStatement(bankAccountId: string, fileName: string, lines: BankBookLineInput[]): Promise<{ success: boolean; saved?: number; skipped?: number; error?: string }> {
  try {
    if (!bankAccountId || lines.length === 0) return { success: true, saved: 0, skipped: 0 };
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Not allowed.' };

    const { data: bank } = await supabase.from('workspace_bank_accounts').select('id').eq('id', bankAccountId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!bank) return { success: false, error: 'That bank account does not belong to this company.' };

    // The same text on the same day for the same amount can really happen twice: count the occurrence inside the file.
    const seen = new Map<string, number>();
    const rows = lines
      .filter((l) => l.date && Number.isFinite(l.amount))
      .map((l) => {
        const base = [l.date, l.amount, l.sourceDestination, l.transactionDetails, l.notes].join('|');
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        return {
          workspace_id: ctx.activeWorkspaceId,
          bank_account_id: bankAccountId,
          date: l.date,
          description: (l.sourceDestination || l.transactionDetails || '-').slice(0, 500),
          counterparty: l.sourceDestination || null,
          details: l.transactionDetails || null,
          notes: l.notes || null,
          rek_from: l.rekFrom || null,
          amount: l.amount,
          file_name: fileName.slice(0, 200),
          fingerprint: crypto.createHash('sha1').update(`${base}|${n}`).digest('hex'),
        };
      });

    let saved = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .upsert(rows.slice(i, i + 500), { onConflict: 'bank_account_id,fingerprint', ignoreDuplicates: true })
        .select('id');
      if (error) {
        return { success: false, error: error.code === '42703' || /fingerprint|counterparty|no unique/i.test(error.message) ? 'Run supabase/migrations/20261014_bank_book.sql in Supabase first.' : error.message };
      }
      saved += data?.length || 0;
    }
    return { success: true, saved, skipped: rows.length - saved };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not save the statement.' };
  }
}
