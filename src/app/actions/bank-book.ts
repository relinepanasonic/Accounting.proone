'use server';

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { canEditBankBook } from '@/lib/auth/bank-book-editors';
import { matchLines, type ReconciledRecord } from '@/lib/bank-book/link';
import { unreconcileRecord } from '@/app/actions/reconcile';

export interface BankBookLineInput {
  date: string;
  sourceDestination: string;
  transactionDetails: string;
  notes: string;
  rekFrom: string;
  amount: number;
  /** Saldo after this line and the time (HH:MM), when the statement has them. */
  balance?: number;
  time?: string;
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Link stored lines to the records they were reconciled with in Bank Reconcile (same day and amount, the bank text decides when
 * several fit). Lines get status "reconciled" and the id of the expense / income / invoice. Needs 20261014_bank_book.sql.
 */
async function linkReconciled(supabase: Db, workspaceId: string, bankAccountId?: string): Promise<number> {
  let q = supabase.from('bank_statement_lines').select('id, date, amount, counterparty, description').eq('workspace_id', workspaceId).is('transaction_id', null).is('invoice_id', null);
  if (bankAccountId) q = q.eq('bank_account_id', bankAccountId);
  const { data: lines } = await q.limit(5000);
  if (!lines || lines.length === 0) return 0;

  const [{ data: txs }, { data: invs }] = await Promise.all([
    supabase.from('transactions').select('id, invoice_id, bank_reference').eq('workspace_id', workspaceId).eq('reconciled', true).like('bank_reference', 'BANK-REF:%').limit(20000),
    supabase.from('invoices').select('id, bank_reference').eq('workspace_id', workspaceId).eq('reconciled', true).like('bank_reference', 'BANK-REF:%').limit(20000),
  ]);
  const records: ReconciledRecord[] = [
    ...(txs || []).map((t: any) => ({ kind: 'transaction' as const, id: t.id, invoiceId: t.invoice_id, bankReference: t.bank_reference })),
    ...(invs || []).map((i: any) => ({ kind: 'invoice' as const, id: i.id, bankReference: i.bank_reference })),
  ];
  // A payment transaction and its invoice carry the same reference: the payment wins, the invoice is reached through it.
  const paymentInvoiceIds = new Set(records.filter((r) => r.kind === 'transaction' && r.invoiceId).map((r) => r.invoiceId as string));
  const usable = records.filter((r) => !(r.kind === 'invoice' && paymentInvoiceIds.has(r.id)));

  const matches = matchLines(lines.map((l: any) => ({ id: l.id, date: String(l.date).slice(0, 10), amount: Number(l.amount), counterparty: l.counterparty || l.description || '' })), usable);
  let linked = 0;
  for (const [lineId, rec] of matches) {
    const patch = rec.kind === 'transaction'
      ? { status: 'reconciled', transaction_id: rec.id, invoice_id: rec.invoiceId || null, bank_ref: rec.bankReference }
      : { status: 'reconciled', invoice_id: rec.id, bank_ref: rec.bankReference };
    const { error } = await supabase.from('bank_statement_lines').update(patch).eq('id', lineId).eq('workspace_id', workspaceId);
    if (!error) linked++;
  }
  return linked;
}

/**
 * Buku Bank: keep every line of an uploaded statement. Lines already stored (same bank account, date, amount, text) are skipped,
 * so uploading an overlapping statement again never doubles anything; their balance and time are filled in when they were missing.
 * Needs supabase/migrations/20261014_bank_book.sql (and 20261015_bank_book_balance.sql for the balance).
 */
export async function saveBankStatement(bankAccountId: string, fileName: string, lines: BankBookLineInput[]): Promise<{ success: boolean; saved?: number; skipped?: number; linked?: number; error?: string }> {
  try {
    if (!bankAccountId || lines.length === 0) return { success: true, saved: 0, skipped: 0 };
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Not allowed.' };

    const { data: bank } = await supabase.from('workspace_bank_accounts').select('id').eq('id', bankAccountId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!bank) return { success: false, error: 'That bank account does not belong to this company.' };

    // The same text on the same day for the same amount can really happen twice: count the occurrence inside the file.
    const seen = new Map<string, number>();
    const prepared = lines
      .filter((l) => l.date && Number.isFinite(l.amount))
      .map((l) => {
        const base = [l.date, l.amount, l.sourceDestination, l.transactionDetails, l.notes].join('|');
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        return { l, fingerprint: crypto.createHash('sha1').update(`${base}|${n}`).digest('hex') };
      });
    const withBalance = (hasBalanceColumns: boolean) => prepared.map(({ l, fingerprint }) => ({
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
      fingerprint,
      ...(hasBalanceColumns ? { balance: l.balance ?? null, txn_time: l.time ?? null } : {}),
    }));

    const insert = async (rows: ReturnType<typeof withBalance>) => {
      let saved = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const { data, error } = await supabase.from('bank_statement_lines').upsert(rows.slice(i, i + 500), { onConflict: 'bank_account_id,fingerprint', ignoreDuplicates: true }).select('id');
        if (error) return { error };
        saved += data?.length || 0;
      }
      return { saved };
    };

    let hasBalance = true;
    let res = await insert(withBalance(true));
    if ('error' in res && res.error && /balance|txn_time/.test(res.error.message)) {
      // The balance migration is not run yet: store the lines without it.
      hasBalance = false;
      res = await insert(withBalance(false));
    }
    if ('error' in res && res.error) {
      const e = res.error;
      return { success: false, error: e.code === '42703' || /fingerprint|counterparty|no unique/i.test(e.message) ? 'Run supabase/migrations/20261014_bank_book.sql in Supabase first.' : e.message };
    }
    const saved = (res as { saved: number }).saved;

    // Lines that were stored by an earlier upload get their balance and time now.
    if (hasBalance && saved < prepared.length) {
      const fill = prepared.filter((p) => p.l.balance !== undefined);
      for (let i = 0; i < fill.length; i += 25) {
        await Promise.all(fill.slice(i, i + 25).map((p) =>
          supabase.from('bank_statement_lines').update({ balance: p.l.balance, txn_time: p.l.time ?? null }).eq('bank_account_id', bankAccountId).eq('fingerprint', p.fingerprint).is('balance', null)
        ));
      }
    }

    const linked = await linkReconciled(supabase, ctx.activeWorkspaceId, bankAccountId);
    return { success: true, saved, skipped: prepared.length - saved, linked };
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
    const { data: line } = await supabase.from('bank_statement_lines').select('id, transaction_id, invoice_id').eq('id', lineId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!line) return { success: false, error: 'Line not found.' };

    if (line.transaction_id) {
      const { data: t } = await supabase.from('transactions').select('type').eq('id', line.transaction_id).maybeSingle();
      if (t) {
        const res = await unreconcileRecord(line.transaction_id, t.type === 'income' ? 'income' : 'expense');
        if (!res.success) return { success: false, error: res.error || 'Could not terminate the reconcile.' };
      }
    } else if (line.invoice_id) {
      const res = await unreconcileRecord(line.invoice_id, 'invoice');
      if (!res.success) return { success: false, error: res.error || 'Could not terminate the reconcile.' };
    } else {
      return { success: false, error: 'This line is not connected to anything.' };
    }

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
