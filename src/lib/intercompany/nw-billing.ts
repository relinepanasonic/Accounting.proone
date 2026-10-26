import { NEW_WAVE_WORKSPACE_ID, PT_WORKSPACE_ID } from '@/lib/workspaces/known';
import { resolveArAccount } from '@/lib/accounting/accounts';

/**
 * Back-to-back invoicing between PT Pintu (PLIG) and New Wave.
 *
 * PT invoices the client (as always). For a PT invoice that is a New Wave job, New Wave invoices PT PLIG for the DPP of that invoice
 * (without VAT and without PPh), and PT books the same amount as its cost (COA 5050 Subcontractor Costs). PT then pays New Wave by transfer:
 * for PT that is a normal Cash Paid match, for New Wave a normal Cash Received match.
 *
 * Everything here is idempotent: syncNwBilling can run any number of times for the same invoice (every save, and a daily safety net).
 * The links: invoices.intercompany_of (the NW invoice -> the PT invoice), invoices.intercompany_invoice_id (the PT invoice -> the NW invoice),
 * transactions.intercompany_of (the PT cost line -> the PT invoice). See supabase/migrations/20261030_intercompany_billing.sql.
 */
type Db = any;

export const BILLING_FROM = '2026-01-01';
export const PLIG_CLIENT_NAME = 'PT Pintu Langit Inovasi Global';
export const COST_ACCOUNT = '5050';
export const COST_CATEGORY = '5050 - Subcontractor Costs';
const NOT_ISSUED = new Set(['draft', 'cancelled', 'canceled', 'void']);
const MISSING = 'Run supabase/migrations/20261030_intercompany_billing.sql in Supabase first.';
const round2 = (n: number) => Math.round(n * 100) / 100;

/** DPP: the invoice without VAT and without the PPh that the client withholds (total = DPP + VAT - PPh). */
export function dppOf(inv: { dpp_amount?: number | string | null; total_amount?: number | string | null; tax_amount?: number | string | null; pph_amount?: number | string | null }): number {
  const dpp = Number(inv.dpp_amount || 0);
  if (dpp > 0) return round2(dpp);
  return round2(Math.max(0, Number(inv.total_amount || 0) - Number(inv.tax_amount || 0) + Number(inv.pph_amount || 0)));
}

/** "INV-2026-163" -> "NW-2026-163". */
export const nwInvoiceNumber = (ptNumber: string) => `NW-${String(ptNumber || '').replace(/^INV-?/i, '')}`;

/** What New Wave's invoice says: the service, and whose project it is for. */
export function billingDescription(items: string[], clientName: string, ptNumber: string) {
  const what = Array.from(new Set(items.map((s) => String(s || '').trim()).filter(Boolean))).join(' + ') || 'Live service';
  return `${what} - ${clientName || 'Client'} (${ptNumber})`;
}

export type BillingAction = 'skip' | 'create' | 'update' | 'remove' | 'blocked' | 'unchanged';

/** The decision, pure: what has to happen for this PT invoice. */
export function decideBilling(input: {
  pt: { workspace_id: string; assigned_workspace_id?: string | null; is_quotation?: boolean | null; status?: string | null; issue_date: string };
  nw?: { total_amount: number; amount_paid?: number | null; status?: string | null; issue_date: string; due_date: string; description: string } | null;
  want: { amount: number; dueDate: string; description: string };
}): BillingAction {
  const { pt, nw, want } = input;
  const isJob = pt.workspace_id === PT_WORKSPACE_ID && pt.assigned_workspace_id === NEW_WAVE_WORKSPACE_ID && !pt.is_quotation && String(pt.issue_date).slice(0, 10) >= BILLING_FROM;
  const issued = !NOT_ISSUED.has(String(pt.status || '').toLowerCase());
  if (!isJob || !issued) return nw ? 'remove' : 'skip';
  if (want.amount <= 0) return nw ? 'remove' : 'skip';
  if (!nw) return 'create';
  const same = Math.abs(Number(nw.total_amount) - want.amount) < 0.01 && String(nw.issue_date).slice(0, 10) === String(pt.issue_date).slice(0, 10) && String(nw.due_date).slice(0, 10) === want.dueDate && nw.description === want.description;
  if (same) return 'unchanged';
  const paid = Number(nw.amount_paid || 0) > 0 || String(nw.status || '').toLowerCase() === 'paid';
  return paid && Math.abs(Number(nw.total_amount) - want.amount) >= 0.01 ? 'blocked' : 'update';
}

async function mappingsOf(db: Db, workspaceId: string) {
  const { data } = await db.from('workspace_mappings').select('mapping_type, account_code').eq('workspace_id', workspaceId);
  return (data || []) as Array<{ mapping_type: string; account_code: string }>;
}

async function plgClientId(db: Db): Promise<string | null> {
  const { data: found } = await db.from('clients').select('id').eq('workspace_id', NEW_WAVE_WORKSPACE_ID).ilike('name', PLIG_CLIENT_NAME).limit(1);
  if (found?.length) return found[0].id;
  const { data, error } = await db.from('clients').insert({ workspace_id: NEW_WAVE_WORKSPACE_ID, name: PLIG_CLIENT_NAME, company_name: PLIG_CLIENT_NAME, contact_type: 'client', is_prospect: false }).select('id').single();
  if (error) {
    // is_prospect may not exist everywhere
    const retry = await db.from('clients').insert({ workspace_id: NEW_WAVE_WORKSPACE_ID, name: PLIG_CLIENT_NAME, company_name: PLIG_CLIENT_NAME, contact_type: 'client' }).select('id').single();
    return retry.data?.id || null;
  }
  return data.id;
}

/** New Wave's side: the receivable and the sales of the invoice (one pair, replaced when the amount changes). */
async function postNwInvoice(db: Db, nwInvoiceId: string, number: string, amount: number, date: string) {
  await db.from('journal_entries').delete().eq('reference_id', nwInvoiceId).eq('reference_type', 'invoice').eq('workspace_id', NEW_WAVE_WORKSPACE_ID);
  const m = await mappingsOf(db, NEW_WAVE_WORKSPACE_ID);
  let sales = m.find((x) => x.mapping_type === 'SALES')?.account_code || '4000';
  if (sales === '4001') sales = '4000';
  const ar = resolveArAccount(m);
  const { error } = await db.from('journal_entries').insert([
    { workspace_id: NEW_WAVE_WORKSPACE_ID, account_code: ar, transaction_date: date, debit_amount: amount, credit_amount: 0, description: `Invoice ${number}`, reference_id: nwInvoiceId, reference_type: 'invoice' },
    { workspace_id: NEW_WAVE_WORKSPACE_ID, account_code: sales, transaction_date: date, debit_amount: 0, credit_amount: amount, description: `Invoice ${number}`, reference_id: nwInvoiceId, reference_type: 'invoice' },
  ]);
  return error?.message || null;
}

/** PT's side: the cost line (COGS 5050) and its ledger pair (cost / accounts payable). */
async function postPtCost(db: Db, txId: string, description: string, amount: number, date: string) {
  await db.from('journal_entries').delete().eq('reference_id', txId).eq('reference_type', 'expense').eq('workspace_id', PT_WORKSPACE_ID);
  const m = await mappingsOf(db, PT_WORKSPACE_ID);
  const ap = m.find((x) => x.mapping_type === 'AP')?.account_code || '2000';
  const { error } = await db.from('journal_entries').insert([
    { workspace_id: PT_WORKSPACE_ID, account_code: COST_ACCOUNT, transaction_date: date, debit_amount: amount, credit_amount: 0, description, reference_id: txId, reference_type: 'expense' },
    { workspace_id: PT_WORKSPACE_ID, account_code: ap, transaction_date: date, debit_amount: 0, credit_amount: amount, description, reference_id: txId, reference_type: 'expense' },
  ]);
  return error?.message || null;
}

/** A transfer PT already made to Nico for this job (before this existed) is the payment of the cost line: it is re-labelled, not booked twice. */
async function adoptTransfer(db: Db, ptInvoiceId: string, amount: number, issueDate: string): Promise<string | null> {
  const end = new Date(Date.parse(`${issueDate}T00:00:00Z`) + 60 * 86400000).toISOString().slice(0, 10);
  const { data } = await db.from('transactions').select('id, category, description, amount')
    .eq('workspace_id', PT_WORKSPACE_ID).eq('type', 'expense').is('intercompany_of', null).eq('amount', amount)
    .ilike('description', 'NICO WINARTA JAPAR%').gte('transaction_date', issueDate).lte('transaction_date', end);
  const candidates = (data || []).filter((t: any) => !/^\s*3/.test(String(t.category || '')) && !/DEVIDEN|DIVIDEN|DIVIDEND/i.test(String(t.description || '')));
  if (candidates.length !== 1) return null; // none, or not sure which one: a new cost line is made instead
  const tx = candidates[0];
  const oldCode = String(tx.category || '').split(' ')[0].trim();
  const { error } = await db.from('transactions').update({ category: COST_CATEGORY, intercompany_of: ptInvoiceId }).eq('id', tx.id);
  if (error) return null;
  if (/^\d+$/.test(oldCode) && oldCode !== COST_ACCOUNT) await db.from('journal_entries').update({ account_code: COST_ACCOUNT }).eq('reference_id', tx.id).eq('account_code', oldCode).gt('debit_amount', 0);
  return tx.id;
}

export interface BillingResult { ok: boolean; action: BillingAction; error?: string; nwInvoiceId?: string; amount?: number }

/** Takes the invoices of both sides away again (the PT invoice is no longer a New Wave job, or is void/draft). Only while nothing is paid. */
async function removeBilling(db: Db, ptInvoiceId: string, nwInvoiceId: string): Promise<BillingResult> {
  const { data: nw } = await db.from('invoices').select('id, status, amount_paid').eq('id', nwInvoiceId).maybeSingle();
  if (nw && (Number(nw.amount_paid || 0) > 0 || String(nw.status).toLowerCase() === 'paid')) return { ok: false, action: 'blocked', error: 'New Wave already received payment on its invoice to PT: undo that payment first.' };
  const { data: cost } = await db.from('transactions').select('id, reconciled').eq('intercompany_of', ptInvoiceId).eq('workspace_id', PT_WORKSPACE_ID);
  if ((cost || []).some((c: any) => c.reconciled)) return { ok: false, action: 'blocked', error: 'PT already paid the cost line to New Wave: undo that match first.' };
  for (const c of cost || []) {
    await db.from('journal_entries').delete().eq('reference_id', c.id);
    await db.from('transactions').delete().eq('id', c.id);
  }
  if (nw) {
    await db.from('journal_entries').delete().eq('reference_id', nw.id).eq('workspace_id', NEW_WAVE_WORKSPACE_ID);
    await db.from('invoice_line_items').delete().eq('invoice_id', nw.id);
    await db.from('invoices').delete().eq('id', nw.id);
  }
  await db.from('invoices').update({ intercompany_invoice_id: null }).eq('id', ptInvoiceId);
  return { ok: true, action: 'remove' };
}

/** Makes sure the New Wave invoice and the PT cost line of one PT invoice are what they should be. Safe to call again and again. */
export async function syncNwBilling(db: Db, ptInvoiceId: string, opts: { dryRun?: boolean } = {}): Promise<BillingResult> {
  const { data: pt, error } = await db.from('invoices')
    .select('id, workspace_id, assigned_workspace_id, invoice_number, status, is_quotation, issue_date, due_date, dpp_amount, total_amount, tax_amount, pph_amount, intercompany_invoice_id, clients(name), invoice_line_items(package_name, description)')
    .eq('id', ptInvoiceId).maybeSingle();
  if (error) return { ok: false, action: 'skip', error: /intercompany|42703|PGRST204/.test(`${error.code} ${error.message}`) ? MISSING : error.message };
  if (!pt) return { ok: false, action: 'skip', error: 'Invoice not found.' };
  // An invoice that was never a job and has no link: nothing to do (the common case, kept cheap).
  if (pt.workspace_id !== PT_WORKSPACE_ID) return { ok: true, action: 'skip' };
  if (pt.assigned_workspace_id !== NEW_WAVE_WORKSPACE_ID && !pt.intercompany_invoice_id) return { ok: true, action: 'skip' };

  const clientName = (Array.isArray(pt.clients) ? pt.clients[0]?.name : pt.clients?.name) || 'Client';
  const items = (pt.invoice_line_items || []).map((l: any) => l.package_name || l.description);
  const amount = dppOf(pt);
  const dueDate = String(pt.due_date || pt.issue_date).slice(0, 10);
  const description = billingDescription(items, clientName, pt.invoice_number);

  let nw: any = null;
  if (pt.intercompany_invoice_id) {
    const { data } = await db.from('invoices').select('id, total_amount, amount_paid, status, issue_date, due_date, invoice_number, invoice_line_items(description)').eq('id', pt.intercompany_invoice_id).maybeSingle();
    if (data) nw = { ...data, description: data.invoice_line_items?.[0]?.description || '' };
  }

  const action = decideBilling({ pt, nw, want: { amount, dueDate, description } });
  if (opts.dryRun || action === 'skip' || action === 'unchanged') return { ok: true, action, amount, nwInvoiceId: nw?.id };
  if (action === 'blocked') return { ok: false, action, error: `New Wave was already paid for this job: the invoice to PT cannot change to Rp ${Math.round(amount).toLocaleString('id-ID')}.`, nwInvoiceId: nw?.id };
  if (action === 'remove') return pt.intercompany_invoice_id ? removeBilling(db, ptInvoiceId, pt.intercompany_invoice_id) : { ok: true, action: 'skip' };

  const issue = String(pt.issue_date).slice(0, 10);
  const number = nwInvoiceNumber(pt.invoice_number);

  if (action === 'update') {
    const nwId = nw.id as string;
    const { error: uErr } = await db.from('invoices').update({ issue_date: issue, due_date: dueDate, subtotal: amount, total_amount: amount, dpp_amount: 0, invoice_number: number }).eq('id', nwId);
    if (uErr) return { ok: false, action, error: uErr.message };
    await db.from('invoice_line_items').update({ description, unit_price: amount }).eq('invoice_id', nwId);
    const pErr = await postNwInvoice(db, nwId, number, amount, issue);
    // the cost line of PT follows while it is not paid
    const { data: cost } = await db.from('transactions').select('id, reconciled').eq('intercompany_of', ptInvoiceId).eq('workspace_id', PT_WORKSPACE_ID).maybeSingle();
    if (cost && !cost.reconciled) {
      await db.from('transactions').update({ amount, due_date: dueDate, transaction_date: issue, description: `New Wave - ${pt.invoice_number}` }).eq('id', cost.id);
      await postPtCost(db, cost.id, `New Wave - ${pt.invoice_number}`, amount, issue);
    }
    return pErr ? { ok: false, action, error: pErr } : { ok: true, action, nwInvoiceId: nwId, amount };
  }

  // create
  const clientId = await plgClientId(db);
  if (!clientId) return { ok: false, action, error: 'Could not make the client PT Pintu Langit Inovasi Global in New Wave.' };
  const { data: bank } = await db.from('workspace_bank_accounts').select('id').eq('workspace_id', NEW_WAVE_WORKSPACE_ID).order('is_default', { ascending: false }).limit(1);
  const base: any = {
    workspace_id: NEW_WAVE_WORKSPACE_ID, client_id: clientId, invoice_number: number, is_quotation: false, status: 'sent',
    issue_date: issue, due_date: dueDate, subtotal: amount, total_amount: amount, discount_amount: 0, tax_amount: 0, tax_calculation_type: 'none',
    has_ppn: false, has_pph: false, pph_amount: 0, dpp_amount: 0, notes: `Intercompany: invoice ${pt.invoice_number} of PT Pintu`, intercompany_of: ptInvoiceId,
  };
  if (bank?.[0]?.id) base.bank_account_id = bank[0].id;
  let ins = await db.from('invoices').insert(base).select('id').single();
  if (ins.error && /bank_account_id/.test(ins.error.message)) { delete base.bank_account_id; ins = await db.from('invoices').insert(base).select('id').single(); }
  if (ins.error || !ins.data) {
    if (ins.error?.code === '23505') {
      // an earlier run made it but the link was not saved: find it again by its number
      const { data: again } = await db.from('invoices').select('id').eq('workspace_id', NEW_WAVE_WORKSPACE_ID).eq('invoice_number', number).maybeSingle();
      if (again) { await db.from('invoices').update({ intercompany_invoice_id: again.id }).eq('id', ptInvoiceId); return { ok: true, action: 'update', nwInvoiceId: again.id, amount }; }
    }
    return { ok: false, action, error: /intercompany|42703|PGRST204/.test(`${ins.error?.code} ${ins.error?.message}`) ? MISSING : ins.error?.message || 'Could not make the invoice.' };
  }
  const nwId = ins.data.id as string;
  const { error: lErr } = await db.from('invoice_line_items').insert({ workspace_id: NEW_WAVE_WORKSPACE_ID, invoice_id: nwId, package_name: null, description, quantity: 1, scale: 'pc', unit_price: Math.round(amount), discount_amount: 0, sort_order: 1 });
  if (lErr) { await db.from('invoices').delete().eq('id', nwId); return { ok: false, action, error: lErr.message }; }
  const pErr = await postNwInvoice(db, nwId, number, amount, issue);
  if (pErr) return { ok: false, action, error: pErr };
  await db.from('invoices').update({ intercompany_invoice_id: nwId }).eq('id', ptInvoiceId);

  // PT's cost line: an earlier transfer to Nico for this job when there is exactly one, else a new unpaid line.
  const have = await db.from('transactions').select('id').eq('intercompany_of', ptInvoiceId).eq('workspace_id', PT_WORKSPACE_ID).maybeSingle();
  if (!have.data) {
    const adopted = await adoptTransfer(db, ptInvoiceId, amount, issue);
    if (!adopted) {
      const { data: tx, error: tErr } = await db.from('transactions').insert({
        workspace_id: PT_WORKSPACE_ID, type: 'expense', category: COST_CATEGORY, amount, description: `New Wave - ${pt.invoice_number}`,
        transaction_date: issue, due_date: dueDate, reconciled: false, is_upcoming_bill: true, intercompany_of: ptInvoiceId,
      }).select('id').single();
      if (tErr || !tx) return { ok: false, action, error: tErr?.message || 'Could not make the cost line in PT.', nwInvoiceId: nwId };
      const cErr = await postPtCost(db, tx.id, `New Wave - ${pt.invoice_number}`, amount, issue);
      if (cErr) return { ok: false, action, error: cErr, nwInvoiceId: nwId };
    }
  }
  return { ok: true, action, nwInvoiceId: nwId, amount };
}

export interface BillingSummary { checked: number; created: number; updated: number; removed: number; unchanged: number; blocked: number; errors: string[]; total: number }

/** All the PT invoices that are New Wave jobs (and those that still carry a link), from January 2026. */
export async function syncAllNwBilling(db: Db, opts: { dryRun?: boolean } = {}): Promise<BillingSummary> {
  const out: BillingSummary = { checked: 0, created: 0, updated: 0, removed: 0, unchanged: 0, blocked: 0, errors: [], total: 0 };
  const { data, error } = await db.from('invoices').select('id, invoice_number').eq('workspace_id', PT_WORKSPACE_ID).or(`assigned_workspace_id.eq.${NEW_WAVE_WORKSPACE_ID},intercompany_invoice_id.not.is.null`).order('issue_date');
  if (error) { out.errors.push(/intercompany|42703/.test(`${error.code} ${error.message}`) ? MISSING : error.message); return out; }
  for (const inv of data || []) {
    out.checked++;
    const r = await syncNwBilling(db, inv.id, opts);
    if (!r.ok) { out.errors.push(`${inv.invoice_number}: ${r.error}`); if (r.action === 'blocked') out.blocked++; continue; }
    if (r.action === 'create') { out.created++; out.total += r.amount || 0; }
    else if (r.action === 'update') out.updated++;
    else if (r.action === 'remove') out.removed++;
    else if (r.action === 'unchanged') out.unchanged++;
  }
  return out;
}

/** The PT invoice is being deleted: its New Wave invoice and PT cost line go with it (blocked once money moved). */
export async function removeNwBilling(db: Db, ptInvoiceId: string): Promise<BillingResult> {
  const { data, error } = await db.from('invoices').select('intercompany_invoice_id').eq('id', ptInvoiceId).maybeSingle();
  if (error) return { ok: true, action: 'skip' }; // the columns are not there yet: nothing to remove
  if (!data?.intercompany_invoice_id) return { ok: true, action: 'skip' };
  return removeBilling(db, ptInvoiceId, data.intercompany_invoice_id);
}
