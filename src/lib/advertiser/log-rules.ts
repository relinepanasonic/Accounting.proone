// Rules of the Input Log form (pure): which rows count, what must be filled before a save, and which tab shows the green check.

export type LogTab = 'inkubasi' | 'group' | 'mandiri';
type Row = Record<string, any>;

const text = (v: unknown) => String(v ?? '').trim();
/** A field is filled when something is in it. A 0 is filled; an empty box is not. */
export const isFilled = (v: unknown) => text(v) !== '';

/** A row is in use when anything about it is typed: the ad, its budget, its target or its numbers. Untouched rows are ignored. */
export const rowUsed = (r: Row) => ['infoIklan', 'modalHarian', 'targetRoas', 'biayaIklan', 'penjualan', 'konversi', 'produkTerjual'].some((k) => isFilled(r?.[k]));

export interface MissingNumbers { tab: LogTab; label: string; rows: number; groupCategory?: string; groupName?: string; /** Row numbers (1 = first) and which box is empty, to tell the person exactly where. */ where: string[] }

/** Rows in use whose Biaya Iklan or Penjualan is empty (0 is fine). Grouped by the tab (and the group) they are in. */
export function missingNumbers(inkubasi: Row[], group: Row[], mandiri: Row[]): MissingNumbers[] {
  const which = (r: Row) => [!isFilled(r.biayaIklan) ? 'Biaya Iklan' : '', !isFilled(r.penjualan) ? 'Penjualan' : ''].filter(Boolean).join(' + ');
  const bad = (r: Row) => rowUsed(r) && (!isFilled(r.biayaIklan) || !isFilled(r.penjualan));
  const name = (r: Row) => text(r.infoIklan) || text(r.iklanProduk);
  const where = (r: Row, i: number) => `row ${i + 1}${name(r) ? ` (${name(r).slice(0, 30)})` : ''}: ${which(r)}`;
  const out: MissingNumbers[] = [];
  const inkRows = (inkubasi || []).map((r, i) => ({ r, i })).filter(({ r }) => bad(r));
  if (inkRows.length) out.push({ tab: 'inkubasi', label: 'GMV Max Auto', rows: inkRows.length, where: inkRows.map(({ r, i }) => where(r, i)) });
  const byGroup = new Map<string, MissingNumbers>();
  (group || []).forEach((r, i) => {
    if (!bad(r)) return;
    const key = `${r.groupCategory}|${r.groupName}`;
    const cur = byGroup.get(key) || { tab: 'group' as const, label: 'Iklan Group', rows: 0, groupCategory: r.groupCategory, groupName: r.groupName, where: [] as string[] };
    cur.rows++; cur.where.push(where(r, i));
    byGroup.set(key, cur);
  });
  const groupRows = Array.from(byGroup.values());
  if (groupRows.length) out.push({ tab: 'group', label: 'Iklan Group', rows: groupRows.reduce((t, g) => t + g.rows, 0), groupCategory: groupRows[0].groupCategory, groupName: groupRows[0].groupName, where: groupRows.flatMap((g) => g.where) });
  const manRows = (mandiri || []).map((r, i) => ({ r, i })).filter(({ r }) => bad(r));
  if (manRows.length) out.push({ tab: 'mandiri', label: 'Mandiri', rows: manRows.length, where: manRows.map(({ r, i }) => where(r, i)) });
  return out;
}

/** What is saved of a tab, to compare with what is on the screen. */
export const snapshotOf = (rows: Row[]) => JSON.stringify((rows || []).filter(rowUsed));

/** Green check: this tab is saved and has numbers. Amber: something typed on it is not saved yet. */
export function tabState(current: Row[], saved: string): 'saved' | 'edited' | 'none' {
  const used = (current || []).filter(rowUsed);
  if (!used.length) return 'none';
  if (JSON.stringify(used) !== saved) return 'edited';
  return used.some((r) => isFilled(r.biayaIklan) && isFilled(r.penjualan)) ? 'saved' : 'none';
}
