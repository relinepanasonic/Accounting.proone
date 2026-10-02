// Ledger Check: for every invoice of the active workspace, compare what the invoice says with what the ledger
// (journal_entries) really holds, and flag anything that does not add up. Server-side only (uses the user's
// session, so row rules apply). Read-only: nothing here changes data.
import { resolveArAccount, DEFAULT_AR_ACCOUNT } from '@/lib/accounting/accounts';

type Db = any;

export type CheckFlag = 'DRAFT_POSTED' | 'NOT_POSTED' | 'POSTED_WRONG' | 'OVERPAID' | 'DUP_BANK' | 'OPEN_DIFF' | 'WRONG_ACCOUNT';


export interface CheckLine {
  date: string;
  account: string;
  accountName: string;
  debit: number;
  credit: number;
  type: string;
  description: string;
}

export interface CheckRow {
  id: string;
  number: string;
  client: string;
  status: string;
  issueDate: string | null;
  total: number;
  paidApp: number; // what the invoice record says was paid
  posted: number; // receivable posted by the invoice in the ledger
  received: number; // receivable cleared by payments in the ledger
  ledgerOpen: number;
  appOpen: number;
  flags: CheckFlag[];
  lines: CheckLine[];
  bankRefs: { ref: string; times: number }[];
  check: { verdict: 'ok' | 'problem'; note: string | null; by: string | null; at: string } | null;
}

export interface CheckResult {
  rows: CheckRow[];
  arAccounts: { code: string; name: string; balance: number }[];
  invoicesOwe: number; // sum of what non-draft invoices say is still owed
  checksReady: boolean;
}

const PAYMENT_TYPES = new Set(['bank_match', 'payment', 'payment_tx', 'invoice_payment']);
const r2 = (n: number) => Math.round(n * 100) / 100;

async function all(q: () => any): Promise<any[]> {
  let out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error || !data) break;
    out = out.concat(data);
    if (data.length < 1000) break;
  }
  return out;
}

async function inChunks(ids: string[], q: (chunk: string[]) => any): Promise<any[]> {
  let out: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await q(ids.slice(i, i + 150));
    out = out.concat(data || []);
  }
  return out;
}

export async function loadLedgerCheck(db: Db, workspaceId: string, clientName: (name: string | null, assigned: string | null) => string): Promise<CheckResult> {
  const invoices = await all(() =>
    db
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, issue_date, assigned_workspace_id, clients ( name )')
      .eq('workspace_id', workspaceId)
      .eq('is_quotation', false)
      .order('issue_date', { ascending: false })
  );
  const invIds = invoices.map((i) => i.id);

  // Payments booked with the "Paid" button point at a transaction that carries the invoice id.
  const txs = await inChunks(invIds, (c) => db.from('transactions').select('id, invoice_id').in('invoice_id', c));
  const txToInv = new Map<string, string>(txs.map((t: any) => [t.id, t.invoice_id]));

  const je = await inChunks([...invIds, ...txs.map((t: any) => t.id)], (c) =>
    db
      .from('journal_entries')
      .select('id, transaction_date, account_code, debit_amount, credit_amount, description, reference_type, reference_id, created_at')
      .eq('workspace_id', workspaceId)
      .in('reference_id', c)
  );

  const { data: mappings } = await db.from('workspace_ledger_mappings').select('mapping_type, account_code').eq('workspace_id', workspaceId);
  const arMain = resolveArAccount(mappings || []);
  const arSet = new Set([arMain, DEFAULT_AR_ACCOUNT]);

  const { data: coa } = await db.from('global_chart_of_accounts').select('account_code, account_name').eq('workspace_id', workspaceId);
  const accName = new Map<string, string>((coa || []).map((a: any) => [a.account_code, a.account_name]));

  const { data: checks, error: checksErr } = await db.from('ledger_checks').select('invoice_id, verdict, note, checked_by_name, checked_at').eq('workspace_id', workspaceId);
  const checkBy = new Map<string, any>((checks || []).map((c: any) => [c.invoice_id, c]));

  const linesByInv = new Map<string, any[]>();
  for (const l of je) {
    const invId = txToInv.get(l.reference_id) || l.reference_id;
    (linesByInv.get(invId) || linesByInv.set(invId, []).get(invId)!).push(l);
  }

  const rows: CheckRow[] = invoices.map((inv) => {
    const ls = (linesByInv.get(inv.id) || []).sort((a, b) => String(a.transaction_date).localeCompare(String(b.transaction_date)) || String(a.created_at).localeCompare(String(b.created_at)));
    const invoiceLines = ls.filter((l) => l.reference_type === 'invoice');
    const payLines = ls.filter((l) => PAYMENT_TYPES.has(l.reference_type));

    const posted = invoiceLines.reduce((s, l) => s + Number(l.debit_amount), 0);
    const received = payLines.reduce((s, l) => s + Number(l.credit_amount), 0);
    const total = Number(inv.total_amount || 0);
    const paidApp = Number(inv.amount_paid || 0);
    const status = String(inv.status || 'draft').toLowerCase();
    const isDraft = status === 'draft';

    // A posting = the lines written together for one bank reference.
    const postings = new Map<string, string>();
    for (const l of payLines) {
      const ref = (String(l.description).match(/BANK-REF:[^|]*/)?.[0] || '').trim();
      if (ref) postings.set(`${ref}@@${l.created_at}`, ref);
    }
    const refCount = new Map<string, number>();
    postings.forEach((ref) => refCount.set(ref, (refCount.get(ref) || 0) + 1));
    const bankRefs = Array.from(refCount.entries()).map(([ref, times]) => ({ ref, times }));

    const flags: CheckFlag[] = [];
    if (isDraft && ls.length > 0) flags.push('DRAFT_POSTED');
    if (!isDraft && total > 0 && posted === 0) flags.push('NOT_POSTED');
    if (!isDraft && posted > 0 && Math.abs(posted - total) > 1) flags.push('POSTED_WRONG');
    if (paidApp > total + 1) flags.push('OVERPAID');
    if (bankRefs.some((b) => b.times > 1)) flags.push('DUP_BANK');
    const ledgerOpen = posted - received;
    const appOpen = total - paidApp;
    if (!isDraft && posted > 0 && Math.abs(ledgerOpen - appOpen) > 1) flags.push('OPEN_DIFF');
    const wrongAr =
      invoiceLines.some((l) => Number(l.debit_amount) > 0 && !arSet.has(l.account_code)) ||
      payLines.some((l) => Number(l.credit_amount) > 0 && !arSet.has(l.account_code));
    if (wrongAr) flags.push('WRONG_ACCOUNT');

    const c = checkBy.get(inv.id);
    return {
      id: inv.id,
      number: inv.invoice_number,
      client: clientName(Array.isArray(inv.clients) ? inv.clients[0]?.name : inv.clients?.name, inv.assigned_workspace_id),
      status,
      issueDate: inv.issue_date,
      total: r2(total),
      paidApp: r2(paidApp),
      posted: r2(posted),
      received: r2(received),
      ledgerOpen: r2(ledgerOpen),
      appOpen: r2(appOpen),
      flags,
      lines: ls.map((l) => ({
        date: l.transaction_date,
        account: l.account_code,
        accountName: accName.get(l.account_code) || '',
        debit: Number(l.debit_amount),
        credit: Number(l.credit_amount),
        type: l.reference_type,
        description: l.description,
      })),
      bankRefs,
      check: c ? { verdict: c.verdict, note: c.note, by: c.checked_by_name, at: c.checked_at } : null,
    };
  });

  // Balances of the receivable accounts for the whole workspace (not only invoice lines).
  const arLines = await all(() => db.from('journal_entries').select('account_code, debit_amount, credit_amount').eq('workspace_id', workspaceId).in('account_code', Array.from(arSet)));
  const balances = new Map<string, number>();
  for (const l of arLines) balances.set(l.account_code, (balances.get(l.account_code) || 0) + Number(l.debit_amount) - Number(l.credit_amount));

  return {
    rows,
    arAccounts: Array.from(arSet).map((code) => ({ code, name: accName.get(code) || 'Accounts Receivable', balance: r2(balances.get(code) || 0) })),
    invoicesOwe: r2(rows.filter((r) => r.status !== 'draft').reduce((s, r) => s + r.appOpen, 0)),
    checksReady: !checksErr,
  };
}
