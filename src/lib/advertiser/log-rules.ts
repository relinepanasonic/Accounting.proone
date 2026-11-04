// Rules of the Input Log form (pure): which rows count, what must be filled before a save, and which tab shows the green check.

export type LogTab = 'inkubasi' | 'group' | 'mandiri';
type Row = Record<string, any>;

const text = (v: unknown) => String(v ?? '').trim();
/** A field is filled when something is in it. A 0 is filled; an empty box is not. */
export const isFilled = (v: unknown) => text(v) !== '';

/** A row is in use when anything about it is typed: the ad, its budget, its target or its numbers. Untouched rows are ignored. */
export const rowUsed = (r: Row) => ['infoIklan', 'modalHarian', 'targetRoas', 'biayaIklan', 'penjualan', 'konversi', 'produkTerjual'].some((k) => isFilled(r?.[k]));

export interface MissingNumbers { tab: LogTab; label: string; rows: number; groupCategory?: string; groupName?: string }

/** Rows in use whose Biaya Iklan or Penjualan is empty (0 is fine). Grouped by the tab (and the group) they are in. */
export function missingNumbers(inkubasi: Row[], group: Row[], mandiri: Row[]): MissingNumbers[] {
  const bad = (r: Row) => rowUsed(r) && (!isFilled(r.biayaIklan) || !isFilled(r.penjualan));
  const out: MissingNumbers[] = [];
  const ink = (inkubasi || []).filter(bad).length;
  if (ink) out.push({ tab: 'inkubasi', label: 'GMV Max Auto', rows: ink });
  const byGroup = new Map<string, MissingNumbers>();
  for (const r of group || []) {
    if (!bad(r)) continue;
    const key = `${r.groupCategory}|${r.groupName}`;
    const cur = byGroup.get(key) || { tab: 'group' as const, label: String(r.groupName || r.groupCategory || 'Group'), rows: 0, groupCategory: r.groupCategory, groupName: r.groupName };
    cur.rows++;
    byGroup.set(key, cur);
  }
  out.push(...byGroup.values());
  const man = (mandiri || []).filter(bad).length;
  if (man) out.push({ tab: 'mandiri', label: 'Mandiri', rows: man });
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
