// Storing the lines of a bank statement in Buku Bank, and linking them to what was reconciled in Bank Reconcile.
// Plain server-side functions (no login check here: the callers do that), so the upload action and repair scripts share one code path.
import crypto from 'crypto';
import { matchLines, type ReconciledRecord } from '@/lib/bank-book/link';

type Db = any;

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

/**
 * Link stored lines to the records they were reconciled with in Bank Reconcile (same day and amount, the bank text decides when
 * several fit). Lines get status "reconciled" and the id of the expense / income / invoice.
 */
export async function linkReconciled(db: Db, workspaceId: string, bankAccountId?: string): Promise<number> {
  let q = db.from('bank_statement_lines').select('id, date, amount, counterparty, description').eq('workspace_id', workspaceId).is('transaction_id', null).is('invoice_id', null);
  if (bankAccountId) q = q.eq('bank_account_id', bankAccountId);
  const { data: lines } = await q.limit(5000);
  if (!lines || lines.length === 0) return 0;

  const [{ data: txs }, { data: invs }] = await Promise.all([
    db.from('transactions').select('id, invoice_id, bank_reference').eq('workspace_id', workspaceId).eq('reconciled', true).like('bank_reference', 'BANK-REF:%').limit(20000),
    db.from('invoices').select('id, bank_reference').eq('workspace_id', workspaceId).eq('reconciled', true).like('bank_reference', 'BANK-REF:%').limit(20000),
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
    const { error } = await db.from('bank_statement_lines').update(patch).eq('id', lineId).eq('workspace_id', workspaceId);
    if (!error) linked++;
  }
  return linked;
}

/**
 * Keep every line of a statement. Lines already stored (same bank account, date, amount, text) are skipped, so uploading an
 * overlapping statement again never doubles anything; their balance and time are filled in when they were missing.
 */
export async function storeStatement(db: Db, opts: { workspaceId: string; bankAccountId: string; fileName: string; lines: BankBookLineInput[] }): Promise<{ success: boolean; saved?: number; skipped?: number; linked?: number; error?: string }> {
  const { workspaceId, bankAccountId, fileName, lines } = opts;
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
  const rowsOf = (hasBalanceColumns: boolean) => prepared.map(({ l, fingerprint }) => ({
    workspace_id: workspaceId,
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

  const insert = async (rows: ReturnType<typeof rowsOf>) => {
    let saved = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await db.from('bank_statement_lines').upsert(rows.slice(i, i + 500), { onConflict: 'bank_account_id,fingerprint', ignoreDuplicates: true }).select('id');
      if (error) return { error };
      saved += data?.length || 0;
    }
    return { saved };
  };

  let hasBalance = true;
  let res: any = await insert(rowsOf(true));
  if (res.error && /balance|txn_time/.test(res.error.message)) {
    // The balance migration is not run yet: store the lines without it.
    hasBalance = false;
    res = await insert(rowsOf(false));
  }
  if (res.error) {
    const e = res.error;
    return { success: false, error: e.code === '42703' || /fingerprint|counterparty|no unique/i.test(e.message) ? 'Run supabase/migrations/20261014_bank_book.sql in Supabase first.' : e.message };
  }
  const saved: number = res.saved;

  // Lines that were stored by an earlier upload get their balance and time now.
  if (hasBalance && saved < prepared.length) {
    const fill = prepared.filter((p) => p.l.balance !== undefined);
    for (let i = 0; i < fill.length; i += 25) {
      await Promise.all(fill.slice(i, i + 25).map((p) =>
        db.from('bank_statement_lines').update({ balance: p.l.balance, txn_time: p.l.time ?? null }).eq('bank_account_id', bankAccountId).eq('fingerprint', p.fingerprint).is('balance', null)
      ));
    }
  }

  const linked = await linkReconciled(db, workspaceId, bankAccountId);
  return { success: true, saved, skipped: prepared.length - saved, linked };
}
