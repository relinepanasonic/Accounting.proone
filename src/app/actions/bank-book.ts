'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { canEditBankBook } from '@/lib/auth/bank-book-editors';
import { storeStatement, linkReconciled, type BankBookLineInput } from '@/lib/bank-book/store';
import { unreconcileRecord } from '@/app/actions/reconcile';


/**
 * Buku Bank: keep every line of an uploaded statement (see lib/bank-book/store.ts). Needs supabase/migrations/20261014_bank_book.sql
 * (and 20261015_bank_book_balance.sql for the balance).
 */
export async function saveBankStatement(bankAccountId: string, fileName: string, lines: BankBookLineInput[]): Promise<{ success: boolean; saved?: number; skipped?: number; linked?: number; error?: string }> {
  try {
    if (!bankAccountId || lines.length === 0) return { success: true, saved: 0, skipped: 0 };
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Not allowed.' };

    const { data: bank } = await supabase.from('workspace_bank_accounts').select('id').eq('id', bankAccountId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!bank) return { success: false, error: 'That bank account does not belong to this company.' };

    return await storeStatement(supabase, { workspaceId: ctx.activeWorkspaceId, bankAccountId, fileName, lines });
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not save the statement.' };
  }
}

/** The "Check links" button: look again for lines that were reconciled in Bank Reconcile. */
export async function relinkBankBook(): Promise<{ success: boolean; linked?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Not allowed.' };
    return { success: true, linked: await linkReconciled(supabase, ctx.activeWorkspaceId) };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not check the links.' };
  }
}

/** An undone match: the Buku Bank lines carrying that bank reference are open again. */
export async function releaseBankRef(ref: string): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role) || !ref) return { success: false };
    await supabase.from('bank_statement_lines').update({ status: 'unreconciled', transaction_id: null, invoice_id: null, bank_ref: null }).eq('workspace_id', ctx.activeWorkspaceId).eq('bank_ref', ref);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export interface BankLineConnection {
  kind: 'expense' | 'income' | 'invoice';
  title: string;
  lines: Array<{ label: string; value: string }>;
  href: string;
  hrefLabel: string;
  reference: string;
}

/** What a reconciled line is connected to, and where to see it. */
export async function getBankLineConnection(lineId: string): Promise<{ success: boolean; connection?: BankLineConnection; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    const { data: line } = await supabase.from('bank_statement_lines').select('transaction_id, invoice_id, bank_ref').eq('id', lineId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!line) return { success: false, error: 'Line not found.' };
    const rp = (n: number) => `Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;

    if (line.transaction_id) {
      const { data: t } = await supabase.from('transactions').select('id, type, description, category, amount, due_date, transaction_date, invoice_id, bank_reference').eq('id', line.transaction_id).maybeSingle();
      if (!t) return { success: false, error: 'The connected record no longer exists.' };
      const isIncome = t.type === 'income';
      let invoiceNo = '';
      if (t.invoice_id) {
        const { data: inv } = await supabase.from('invoices').select('invoice_number').eq('id', t.invoice_id).maybeSingle();
        invoiceNo = inv?.invoice_number || '';
      }
      return {
        success: true,
        connection: {
          kind: isIncome ? 'income' : 'expense',
          title: isIncome ? 'Income' : 'Expense',
          lines: [
            { label: 'Description', value: t.description || '-' },
            ...(invoiceNo ? [{ label: 'Invoice', value: invoiceNo }] : []),
            { label: 'Category', value: t.category || '-' },
            { label: 'Amount', value: rp(Number(t.amount || 0)) },
            { label: 'Date', value: String(t.due_date || t.transaction_date || '-').slice(0, 10) },
          ],
          href: isIncome ? '/invoices' : '/expenses',
          hrefLabel: isIncome ? 'Open Income' : 'Open Expenses',
          reference: t.bank_reference || line.bank_ref || '',
        },
      };
    }
    if (line.invoice_id) {
      const { data: i } = await supabase.from('invoices').select('id, invoice_number, total_amount, amount_paid, status, issue_date, bank_reference, clients(name)').eq('id', line.invoice_id).maybeSingle();
      if (!i) return { success: false, error: 'The connected invoice no longer exists.' };
      const client: any = Array.isArray((i as any).clients) ? (i as any).clients[0] : (i as any).clients;
      return {
        success: true,
        connection: {
          kind: 'invoice',
          title: 'Invoice (Income)',
          lines: [
            { label: 'Invoice', value: i.invoice_number || '-' },
            { label: 'Client', value: client?.name || '-' },
            { label: 'Total', value: rp(Number(i.total_amount || 0)) },
            { label: 'Paid', value: rp(Number(i.amount_paid || 0)) },
            { label: 'Status', value: String(i.status || '-') },
          ],
          href: '/invoices',
          hrefLabel: 'Open Income',
          reference: i.bank_reference || line.bank_ref || '',
        },
      };
    }
    return { success: false, error: 'This line is not connected to anything.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not load the connection.' };
  }
}

/** Terminate a reconcile: the expense / income / invoice is open again and the line is unlinked (use it when the connection is wrong). */
export async function terminateBankLink(lineId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Not allowed.' };
    const { data: line } = await supabase.from('bank_statement_lines').select('id, transaction_id, invoice_id, bank_ref').eq('id', lineId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!line) return { success: false, error: 'Line not found.' };

    // Everything this bank line was matched with: the linked record, and every record that carries its bank reference
    // (one transfer can pay several records, and an older match may have no link on the line at all).
    const records = new Map<string, 'income' | 'expense' | 'invoice'>();
    if (line.transaction_id) {
      const { data: t } = await supabase.from('transactions').select('id, type').eq('id', line.transaction_id).maybeSingle();
      if (t) records.set(t.id, t.type === 'income' ? 'income' : 'expense');
    }
    if (line.invoice_id) records.set(line.invoice_id, 'invoice');
    if (line.bank_ref) {
      const { data: txs } = await supabase.from('transactions').select('id, type').eq('workspace_id', ctx.activeWorkspaceId).eq('bank_reference', line.bank_ref).eq('reconciled', true);
      for (const t of txs || []) records.set(t.id, t.type === 'income' ? 'income' : 'expense');
      const { data: invs } = await supabase.from('invoices').select('id').eq('workspace_id', ctx.activeWorkspaceId).eq('bank_reference', line.bank_ref);
      for (const i of invs || []) if (!records.has(i.id)) records.set(i.id, 'invoice');
    }

    for (const [id, kind] of records) {
      const res = await unreconcileRecord(id, kind);
      if (!res.success) return { success: false, error: res.error || 'Could not terminate the reconcile.' };
    }

    // The line is open again even when no record was found (the connection was already broken on that side).
    const { error } = await supabase.from('bank_statement_lines').update({ status: 'unreconciled', transaction_id: null, invoice_id: null, bank_ref: null }).eq('id', lineId).eq('workspace_id', ctx.activeWorkspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not terminate the reconcile.' };
  }
}

export interface BankBookLineEdit { date: string; counterparty: string; details: string; notes: string; amount: number }

/** Edit one stored line. Only the people in lib/auth/bank-book-editors.ts. */
export async function updateBankLine(id: string, edit: BankBookLineEdit): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!canEditBankBook(ctx.userEmail)) return { success: false, error: 'Only the owner and Lucy can edit Buku Bank.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(edit.date) || !Number.isFinite(edit.amount)) return { success: false, error: 'Check the date and the amount.' };
    const { data, error } = await supabase
      .from('bank_statement_lines')
      .update({
        date: edit.date,
        description: (edit.counterparty || edit.details || '-').slice(0, 500),
        counterparty: edit.counterparty || null,
        details: edit.details || null,
        notes: edit.notes || null,
        amount: edit.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', ctx.activeWorkspaceId)
      .select('id');
    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: 'Line not found.' };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not save.' };
  }
}

/** Delete one stored line. Only the people in lib/auth/bank-book-editors.ts. */
export async function deleteBankLine(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!canEditBankBook(ctx.userEmail)) return { success: false, error: 'Only the owner and Lucy can delete Buku Bank lines.' };
    const { data, error } = await supabase.from('bank_statement_lines').delete().eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).select('id');
    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: 'Line not found.' };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not delete.' };
  }
}
