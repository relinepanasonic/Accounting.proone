// Reads the ledger for the financial statements. Server-side only (a ready service-role client is passed in).
import type { CoaMap, LedgerEntry } from '@/lib/reports/financial-statements';
import { NEW_WAVE_WORKSPACE_ID, PT_WORKSPACE_ID } from '@/lib/workspaces/known';

type Db = any;

export interface LoadedLedger { entries: LedgerEntry[]; coa: CoaMap; eliminated: number }

/** Every journal line of these workspaces up to `to` (read in pages of 1000). */
async function journalLines(db: Db, workspaceIds: string[], to: string): Promise<Array<LedgerEntry & { ws: string; refId: string | null }>> {
  const out: Array<LedgerEntry & { ws: string; refId: string | null }> = [];
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await db
      .from('journal_entries')
      .select('account_code, debit_amount, credit_amount, transaction_date, reference_type, reference_id, workspace_id')
      .in('workspace_id', workspaceIds)
      .lte('transaction_date', to)
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const j of data || []) {
      out.push({ account_code: String(j.account_code || ''), debit: Number(j.debit_amount || 0), credit: Number(j.credit_amount || 0), date: String(j.transaction_date).slice(0, 10), refType: j.reference_type, ws: j.workspace_id, refId: j.reference_id });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Account names: the first company in the list that has the account names it. */
async function chartOfAccounts(db: Db, workspaceIds: string[]): Promise<CoaMap> {
  const { data } = await db.from('global_chart_of_accounts').select('workspace_id, account_code, account_name, account_type').in('workspace_id', workspaceIds);
  const order = new Map(workspaceIds.map((id, i) => [id, i]));
  const rows = [...(data || [])].sort((a: any, b: any) => (order.get(a.workspace_id) ?? 99) - (order.get(b.workspace_id) ?? 99));
  const coa: CoaMap = new Map();
  for (const a of rows) if (!coa.has(String(a.account_code))) coa.set(String(a.account_code), { name: String(a.account_name || a.account_code), type: a.account_type });
  return coa;
}

/**
 * New Wave's invoices to PT PLIG and PT's matching cost are inside the group: in the consolidated statements they cancel out.
 *  - the revenue of New Wave against the cost (5050) of PT, on the invoice date;
 *  - the receivable of New Wave against the payable of PT, from the invoice date until New Wave is paid.
 * Returned as extra ledger lines; they exist only in the report.
 */
async function intercompanyElimination(db: Db, to: string): Promise<LedgerEntry[]> {
  const { data: invs, error } = await db.from('invoices').select('id, total_amount, issue_date').eq('workspace_id', NEW_WAVE_WORKSPACE_ID).not('intercompany_of', 'is', null).lte('issue_date', to);
  if (error || !invs?.length) return []; // before 20261030_intercompany_billing.sql: nothing to eliminate
  const ids = invs.map((i: any) => i.id as string);
  const [{ data: lines }, { data: pays }, { data: costs }] = await Promise.all([
    db.from('journal_entries').select('reference_id, account_code, debit_amount, credit_amount').in('reference_id', ids).eq('reference_type', 'invoice'),
    db.from('transactions').select('invoice_id, amount, transaction_date').in('invoice_id', ids).eq('type', 'income').lte('transaction_date', to),
    db.from('transactions').select('id, amount, transaction_date, intercompany_of').eq('workspace_id', PT_WORKSPACE_ID).not('intercompany_of', 'is', null).lte('transaction_date', to),
  ]);
  const costIds = (costs || []).map((c: any) => c.id as string);
  const { data: costLines } = costIds.length ? await db.from('journal_entries').select('reference_id, account_code, debit_amount, credit_amount').in('reference_id', costIds).eq('reference_type', 'expense') : { data: [] as any[] };

  const salesOf = new Map<string, string>(); const arOf = new Map<string, string>();
  for (const l of lines || []) { if (Number(l.credit_amount) > 0) salesOf.set(l.reference_id, String(l.account_code)); if (Number(l.debit_amount) > 0) arOf.set(l.reference_id, String(l.account_code)); }
  let apCode = '2000'; const costCode = new Map<string, string>();
  for (const l of costLines || []) { if (Number(l.credit_amount) > 0) apCode = String(l.account_code); if (Number(l.debit_amount) > 0) costCode.set(l.reference_id, String(l.account_code)); }

  const out: LedgerEntry[] = [];
  const line = (date: string, code: string, debit: number, credit: number) => out.push({ date, account_code: code, debit, credit });
  for (const i of invs) {
    const total = Number(i.total_amount || 0); const date = String(i.issue_date).slice(0, 10);
    // revenue of New Wave against the cost of PT
    line(date, salesOf.get(i.id) || '4000', total, 0);
    line(date, '5050', 0, total);
    // the open amount: payable of PT against receivable of New Wave
    line(date, apCode, total, 0);
    line(date, arOf.get(i.id) || '1100', 0, total);
  }
  for (const p of pays || []) {
    const inv = invs.find((i: any) => i.id === p.invoice_id); if (!inv) continue;
    const amount = Number(p.amount || 0); const date = String(p.transaction_date).slice(0, 10);
    line(date, apCode, 0, amount);
    line(date, arOf.get(inv.id) || '1100', amount, 0);
  }
  void costCode;
  return out;
}

/** The ledger of one company, or of the whole group (consolidated, with the intercompany amounts eliminated). */
export async function loadLedger(db: Db, workspaceIds: string[], to: string, consolidate: boolean): Promise<LoadedLedger> {
  const [lines, coa] = await Promise.all([journalLines(db, workspaceIds, to), chartOfAccounts(db, workspaceIds)]);
  const entries: LedgerEntry[] = lines.map(({ account_code, debit, credit, date, refType }) => ({ account_code, debit, credit, date, refType }));
  let eliminated = 0;
  if (consolidate && workspaceIds.includes(NEW_WAVE_WORKSPACE_ID) && workspaceIds.includes(PT_WORKSPACE_ID)) {
    const elim = await intercompanyElimination(db, to);
    eliminated = elim.length / 4;
    entries.push(...elim);
  }
  return { entries, coa, eliminated };
}

export interface LedgerHealth {
  /** Invoices whose ledger postings do not add up to the invoice (stacked postings from before the fix, a wrong amount, a draft that was posted). */
  mismatched: number;
  /** Postings without any invoice. */
  orphans: number;
  /** Revenue and receivables shown more than the invoices say. */
  overstated: number;
}

/** Compares the invoice postings of the ledger with the invoices themselves. Each issued invoice must be posted exactly once, for its total. */
export async function ledgerHealth(db: Db, workspaceIds: string[]): Promise<LedgerHealth> {
  const out: LedgerHealth = { mismatched: 0, orphans: 0, overstated: 0 };
  for (const ws of workspaceIds) {
    const invoices = new Map<string, number>();
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await db.from('invoices').select('id, total_amount, status, is_quotation').eq('workspace_id', ws).range(from, from + 999);
      if (error) return out;
      for (const i of data || []) invoices.set(i.id, !i.is_quotation && !['draft', 'cancelled', 'canceled', 'void'].includes(String(i.status || '').toLowerCase()) ? Number(i.total_amount || 0) : 0);
      if (!data || data.length < 1000) break;
    }
    const posted = new Map<string, number>();
    for (let from = 0; from < 200000; from += 1000) {
      const { data, error } = await db.from('journal_entries').select('reference_id, debit_amount').eq('workspace_id', ws).eq('reference_type', 'invoice').gt('debit_amount', 0).order('id', { ascending: true }).range(from, from + 999);
      if (error) return out;
      for (const j of data || []) posted.set(j.reference_id, (posted.get(j.reference_id) || 0) + Number(j.debit_amount || 0));
      if (!data || data.length < 1000) break;
    }
    for (const [id, sum] of posted) {
      const expected = invoices.get(id);
      if (expected === undefined) { out.orphans++; out.overstated += sum; continue; }
      if (Math.abs(sum - expected) > 1 && sum > expected) { out.mismatched++; out.overstated += sum - expected; }
    }
  }
  out.overstated = Math.round(out.overstated);
  return out;
}
