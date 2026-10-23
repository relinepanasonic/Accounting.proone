import { createAdminClient } from '@/lib/api/supabase-admin';
import { workspaceCode } from '@/lib/workspaces/known';

/**
 * What still has to be copied to Google Drive (Accounting / Invoice, Tax, Proof). Make.com asks for the pending items, uploads them and
 * confirms each one, so the table drive_sync (migration 20261023) always knows what is already there.
 */
export type DriveFolder = 'Invoice' | 'Tax' | 'Proof';
export interface DriveItem { key: string; kind: 'invoice' | 'faktur' | 'bukti'; folder: DriveFolder; name: string }

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

export async function pendingDriveItems(limit = 20): Promise<{ items: DriveItem[]; remaining: number }> {
  const db: Db = createAdminClient();
  // The company code goes in the file name: two companies can hold an invoice with the same number.
  const { data: workspaces } = await db.from('workspaces').select('id, name');
  const codeOf = (i: any) => workspaceCode(i.workspace_id, (workspaces || []).find((w: any) => w.id === i.workspace_id)?.name);

  // Candidates, oldest invoice first.
  const invoices = await allRows((from) =>
    db.from('invoices').select('id, invoice_number, issue_date, created_at, status, workspace_id, clients(name)').eq('is_quotation', false).order('issue_date', { ascending: true }).range(from, from + 999));
  const issued = invoices.filter((i) => !['draft', 'cancelled', 'canceled', 'void'].includes(String(i.status || '').toLowerCase()));

  const all: DriveItem[] = issued.map((i) => ({ key: `invoice:${i.id}`, kind: 'invoice', folder: 'Invoice', name: `${safe(`${dateOf(i)} ${codeOf(i)} ${i.invoice_number} ${clientOf(i)}`)}.pdf` }));

  for (const [col, kind, label] of [['faktur_pajak_url', 'faktur', 'Faktur Pajak'], ['bukti_potong_url', 'bukti', 'Bukti Potong']] as const) {
    const rows = await allRows((from) =>
      db.from('invoices').select('id, invoice_number, issue_date, created_at, workspace_id, clients(name)').not(col, 'is', null).range(from, from + 999));
    for (const i of rows) all.push({ key: `${kind}:${i.id}`, kind, folder: 'Tax', name: `${safe(`${label} ${codeOf(i)} ${i.invoice_number} ${clientOf(i)}`)}.pdf` });
  }

  // Already copied.
  const done = new Set<string>();
  const keys = all.map((a) => a.key);
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await db.from('drive_sync').select('key').in('key', keys.slice(i, i + 200));
    if (error) throw new Error(`drive_sync: ${error.message} (run supabase/migrations/20261023_drive_sync.sql)`);
    for (const r of data || []) done.add((r as any).key);
  }
  const pending = all.filter((a) => !done.has(a.key));
  const items = pending.slice(0, limit);

  // The real extension of the tax documents (a photo is not a pdf).
  for (const it of items) {
    if (it.kind === 'invoice') continue;
    const col = it.kind === 'faktur' ? 'faktur_pajak_url' : 'bukti_potong_url';
    const { data } = await db.from('invoices').select(col).eq('id', it.key.split(':')[1]).maybeSingle();
    const url = String((data as any)?.[col] || '');
    if (url) it.name = it.name.replace(/\.pdf$/, `.${extensionOf(url)}`);
  }
  return { items, remaining: Math.max(0, pending.length - items.length) };
}

export async function confirmDriveItem(key: string, kind: string, name: string, driveFileId: string) {
  const db: Db = createAdminClient();
  const { error } = await db.from('drive_sync').upsert({ key, kind, name, drive_file_id: driveFileId, synced_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
