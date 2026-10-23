import crypto from 'crypto';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { workspaceCode } from '@/lib/workspaces/known';

/**
 * What still has to be copied to Google Drive (Accounting / Invoice, Tax, Proof). Make.com asks for the pending items, uploads them and
 * confirms each one, so the table drive_sync (migration 20261023) always knows what is already there.
 *
 * Invoice documents:
 *  - an unpaid invoice is copied as the invoice; when it is paid the document is the RECEIPT (a new file "... Receipt.pdf");
 *  - when an invoice is edited after it was copied, the new version is a new file with "ed-1", "ed-2"... in its name (the old file stays).
 * The key of a document is "<invoice|receipt>:<invoice id>:<8 characters of its content>": a changed invoice has a new key, so it is pending again.
 * (Older rows were saved as "invoice:<invoice id>"; they count as version 0 of the invoice.)
 */
export type DriveFolder = 'Invoice' | 'Tax' | 'Proof';
export interface DriveItem { key: string; kind: 'invoice' | 'receipt' | 'faktur' | 'bukti'; folder: DriveFolder; name: string; /** Company code (ProOne, PLIG, NW, DOA): invoices go to Invoice/<company>. */ company: string }

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
const clientOf = (i: any) => String((Array.isArray(i.clients) ? i.clients[0]?.name : i.clients?.name) || '').trim();
const dateOf = (i: any) => String(i.issue_date || i.created_at || '').slice(0, 10);

/** The extension of a stored document: its data URL says the type. */
export function extensionOf(dataUrl: string): string {
  const m = /^data:([^;,]+)/.exec(dataUrl || '');
  const mime = (m?.[1] || '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'pdf';
}

type Db = ReturnType<typeof createAdminClient>;

async function allRows(build: (from: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await build(from);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const digest = (value: unknown) => crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 8);

/** An invoice is settled when it is marked paid. */
const isPaid = (i: any) => String(i.status || '').toLowerCase() === 'paid';

export async function pendingDriveItems(limit = 20): Promise<{ items: DriveItem[]; remaining: number }> {
  const db: Db = createAdminClient();
  // The company code goes in the file name: two companies can hold an invoice with the same number.
  const { data: workspaces } = await db.from('workspaces').select('id, name');
  const codeOf = (i: any) => workspaceCode(i.workspace_id, (workspaces || []).find((w: any) => w.id === i.workspace_id)?.name);

  // The invoices with their lines (explicit columns: the row also holds the uploaded tax documents, which are large).
  const invoices = await allRows((from) =>
    db.from('invoices')
      .select('id, invoice_number, issue_date, due_date, created_at, status, workspace_id, client_id, total_amount, amount_paid, discount_amount, tax_calculation_type, tax_amount, has_pph, pph_amount, notes, bank_account_id, clients(name), invoice_line_items(package_name, description, quantity, unit_price, discount_amount, sort_order)')
      .eq('is_quotation', false).order('issue_date', { ascending: true }).range(from, from + 999));
  const issued = invoices.filter((i) => !['draft', 'cancelled', 'canceled', 'void'].includes(String(i.status || '').toLowerCase()));

  // Payments (for the receipts).
  const payRows = await allRows((from) => db.from('transactions').select('invoice_id, amount, transaction_date').eq('type', 'income').not('invoice_id', 'is', null).range(from, from + 999));
  const payments = new Map<string, Array<[string, number]>>();
  for (const p of payRows) (payments.get(p.invoice_id) || payments.set(p.invoice_id, []).get(p.invoice_id)!).push([String(p.transaction_date || '').slice(0, 10), Number(p.amount || 0)]);

  // The documents already in Drive, per invoice.
  let done: any[];
  try {
    done = await allRows((from) => db.from('drive_sync').select('key, kind').in('kind', ['invoice', 'receipt']).range(from, from + 999));
  } catch (e: any) {
    throw new Error(`drive_sync: ${e.message} (run supabase/migrations/20261023_drive_sync.sql)`);
  }
  const keys = new Set<string>(done.map((r) => String(r.key)));
  const versions = (kind: string, id: string) => done.filter((r) => String(r.key) === `${kind}:${id}` || String(r.key).startsWith(`${kind}:${id}:`)).length;

  const all: DriveItem[] = [];
  for (const i of issued) {
    const paid = isPaid(i);
    const kind = paid ? 'receipt' : 'invoice';
    const lines = [...(i.invoice_line_items || [])].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((l: any) => [l.package_name, l.description, l.quantity, l.unit_price, l.discount_amount]);
    // What the document says: a payment only changes a receipt (an invoice copy keeps showing the invoice as it was issued).
    const content: unknown[] = [i.invoice_number, i.issue_date, i.due_date, i.client_id, clientOf(i), i.total_amount, i.discount_amount, i.tax_calculation_type, i.tax_amount, i.has_pph, i.pph_amount, i.notes, i.bank_account_id, lines];
    if (paid) content.push(payments.get(i.id) || []);
    const sig = digest(content);
    if (keys.has(`${kind}:${i.id}:${sig}`)) continue;
    // A row saved before the versions existed (invoice:<id>) is the current version of an invoice that is not paid; for a receipt there is none.
    if (!paid && keys.has(`invoice:${i.id}`)) continue;
    const n = versions(kind, i.id);
    const base = safe(`${dateOf(i)} ${codeOf(i)} ${i.invoice_number} ${clientOf(i)}`);
    all.push({ key: `${kind}:${i.id}:${sig}`, kind, folder: 'Invoice', company: codeOf(i), name: `${base}${paid ? ' Receipt' : ''}${n > 0 ? ` ed-${n}` : ''}.pdf` });
  }

  // Tax documents (once each).
  const taxKeys = new Set<string>((await allRows((from) => db.from('drive_sync').select('key').in('kind', ['faktur', 'bukti']).range(from, from + 999))).map((r) => String(r.key)));
  for (const [col, kind, label] of [['faktur_pajak_url', 'faktur', 'Faktur Pajak'], ['bukti_potong_url', 'bukti', 'Bukti Potong']] as const) {
    const rows = await allRows((from) =>
      db.from('invoices').select('id, invoice_number, issue_date, created_at, workspace_id, clients(name)').not(col, 'is', null).range(from, from + 999));
    for (const i of rows) {
      const key = `${kind}:${i.id}`;
      if (taxKeys.has(key)) continue;
      all.push({ key, kind, folder: 'Tax', company: codeOf(i), name: `${safe(`${label} ${codeOf(i)} ${i.invoice_number} ${clientOf(i)}`)}.pdf` });
    }
  }

  const items = all.slice(0, limit);

  // The real extension of the tax documents (a photo is not a pdf).
  for (const it of items) {
    if (it.kind !== 'faktur' && it.kind !== 'bukti') continue;
    const col = it.kind === 'faktur' ? 'faktur_pajak_url' : 'bukti_potong_url';
    const { data } = await db.from('invoices').select(col).eq('id', it.key.split(':')[1]).maybeSingle();
    const url = String((data as any)?.[col] || '');
    if (url) it.name = it.name.replace(/\.pdf$/, `.${extensionOf(url)}`);
  }
  return { items, remaining: Math.max(0, all.length - items.length) };
}

export async function confirmDriveItem(key: string, kind: string, name: string, driveFileId: string) {
  const db: Db = createAdminClient();
  const { error } = await db.from('drive_sync').upsert({ key, kind, name, drive_file_id: driveFileId, synced_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** The invoice PDFs already in Drive with the company they belong to (the code is the second word of the file name): used once to move them into Invoice/<company>. */
export async function syncedInvoiceFiles(limit = 1000): Promise<Array<{ fileId: string; name: string; company: string }>> {
  const db: Db = createAdminClient();
  const rows = await allRows((from) => db.from('drive_sync').select('key, name, drive_file_id').in('kind', ['invoice', 'receipt']).order('synced_at', { ascending: true }).range(from, from + 999));
  return rows.filter((r) => r.drive_file_id).slice(0, limit).map((r) => ({ fileId: String(r.drive_file_id), name: String(r.name || ''), company: String(r.name || '').split(' ')[1] || '' }));
}
