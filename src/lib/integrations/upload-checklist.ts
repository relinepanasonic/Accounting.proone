// Pure helpers (client-safe): the 5 files an admin must upload for a store each week. When all 5 are there the weekly report can go to the client's WhatsApp group.
import type { FileEntry } from './upload-performance';

export type ChecklistKey = 'store' | 'product' | 'ads_total' | 'ads_gmv' | 'ads_group';

export const CHECKLIST: Array<{ key: ChecklistKey; label: string; hint: string }> = [
  { key: 'store', label: 'Store Performance', hint: 'Performa (sales_overview)' },
  { key: 'product', label: 'Product Performance', hint: 'SPOS (parentskudetail)' },
  { key: 'ads_total', label: 'Ads Total', hint: 'Ads Performa (all ads)' },
  { key: 'ads_gmv', label: 'Ads Inkubasi / GMV Max Auto', hint: 'GMV Auto Performa' },
  { key: 'ads_group', label: 'Ads Group', hint: 'Group Ads Performa' },
];

/** Which of the 5 a file is: the file name first ("essen ads gmv max nov week 1.csv"), then the type the app logged. */
export function classifyFile(type: string, name: string): ChecklistKey | null {
  const n = (name || '').toLowerCase();
  const t = (type || '').toLowerCase();
  if (/spos|parentsku|product/.test(n)) return 'product';
  if (/\b(group|grup)\b|group.?ads|grup.?iklan/.test(n)) return 'ads_group';
  if (/gmv|inkubasi|incubat/.test(n)) return 'ads_gmv';
  if (/\bads?\b|iklan/.test(n)) return 'ads_total';
  if (/\bps\b|sales.?overview|performa|store/.test(n)) return 'store';
  // no usable name: the type of the upload
  if (/spos|product/.test(t)) return 'product';
  if (/group|grup/.test(t)) return 'ads_group';
  if (/gmv|inkubasi/.test(t)) return 'ads_gmv';
  if (/ads|iklan/.test(t)) return 'ads_total';
  if (/store|performa/.test(t)) return 'store';
  return null;
}

export interface ChecklistState {
  done: Record<ChecklistKey, FileEntry | null>;
  count: number;
  complete: boolean;
}

/** The checklist of one store and week from its files (the latest file counts for each item). */
export function buildChecklist(files: FileEntry[] | null | undefined): ChecklistState {
  const done: Record<ChecklistKey, FileEntry | null> = { store: null, product: null, ads_total: null, ads_gmv: null, ads_group: null };
  for (const f of files || []) {
    const k = classifyFile(f.type, f.name);
    if (k && (!done[k] || f.at > done[k]!.at)) done[k] = f;
  }
  const count = CHECKLIST.filter((c) => done[c.key]).length;
  return { done, count, complete: count === CHECKLIST.length };
}

/** The Monday of the week report for a 7-day block (1-7, 8-14, ...) of a month: the one Monday inside the block. */
export function reportMondayOfBlock(year: number, month: number, block: number): string | null {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = block * 7 + 1;
  const last = Math.min(daysInMonth, first + 6);
  for (let d = first; d <= last; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 1) return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}
