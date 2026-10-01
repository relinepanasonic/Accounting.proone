// Helpers shared by the advertiser log detail window and the PDF report.

export const num = (v: unknown) => parseFloat(String(v ?? '').replace(/\D/g, '') || '0');
export const rupiah = (n: number) => (n ? `Rp ${n.toLocaleString('id-ID')}` : '-');
export const text = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

// A row counts as "worked on" when the advertiser typed anything meaningful into it.
export const hasData = (r: any) =>
  Boolean(r) &&
  ['iklanProduk', 'infoIklan', 'modalHarian', 'biayaIklan', 'penjualan', 'konversi', 'produkTerjual', 'note'].some(
    (k) => String(r[k] ?? '').trim() !== ''
  );

export function totals(rows: any[]) {
  const modal = rows.reduce((s, r) => s + num(r.modalHarian), 0);
  const biaya = rows.reduce((s, r) => s + num(r.biayaIklan), 0);
  const jual = rows.reduce((s, r) => s + num(r.penjualan), 0);
  return { modal, biaya, jual, roas: biaya > 0 ? (jual / biaya).toFixed(2) : '-' };
}

export function normalizeGroup(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  // Older records stored groups as { hero: [], reguler: [], low: [] }.
  if (raw && typeof raw === 'object') {
    return [
      ...(raw.hero || []).map((r: any) => ({ ...r, groupCategory: 'Hero', groupName: 'Group Hero 1' })),
      ...(raw.reguler || []).map((r: any) => ({ ...r, groupCategory: 'Reguler', groupName: 'Group Reguler 1' })),
      ...(raw.low || []).map((r: any) => ({ ...r, groupCategory: 'Low', groupName: 'Group Low 1' })),
    ];
  }
  return [];
}

// Indonesian month abbreviations: Jan Feb Mar Apr Mei Jun Jul Agt Sep Okt Nov Des.
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-09-25" -> { dd: "25", mmm: "Sep", yy: "26" }. Parsed by hand so the timezone can never shift the day. */
export function splitReportDate(reportDate: string) {
  const [y, m, d] = reportDate.slice(0, 10).split('-');
  return { dd: d, mmm: MONTHS_ID[Number(m) - 1] || m, yy: (y || '').slice(-2) };
}

/** Long form for the PDF body, e.g. "25 September 2026". */
export function longReportDate(reportDate: string) {
  const [y, m, d] = reportDate.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "Sesi 1 25 Sep 26 Japar Utomo.pdf" (or .jpg) */
export function sessionPdfFileName(reportDate: string, session: number, clientName: string, ext: "pdf" | "jpg" = "pdf") {
  const { dd, mmm, yy } = splitReportDate(reportDate);
  const safeClient = clientName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Client';
  return `Sesi ${session} ${dd} ${mmm} ${yy} ${safeClient}.${ext}`;
}

// ---------------------------------------------------------------------------------------------
// Comparison with the previous session (Target ROAS and Modal harian only)
// ---------------------------------------------------------------------------------------------

export interface SessionData {
  data_inkubasi: any;
  data_group: any;
  data_mandiri: any;
}

export interface PreviousSession extends SessionData {
  session: number;
  report_date: string;
}

export interface CompareLine {
  label: string;
  text: string;
  changed: boolean;
}

export interface CompareSection {
  title: string;
  lines: CompareLine[];
}

const parseTarget = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmtTarget = (n: number) => String(Number.isInteger(n) ? n : Number(n.toFixed(2)));

// Rows are matched by ad/product name when there is one; otherwise by their position in the table.
const rowKey = (r: any, idx: number) => {
  const name = String(r?.iklanProduk ?? r?.infoIklan ?? '').trim().toLowerCase();
  return name && name !== '-' ? `n|${name}` : `i|${idx}`;
};

function describeRow(cur: any, prev: any | null): { text: string; changed: boolean } {
  const parts: string[] = [];
  let changed = false;

  const curT = parseTarget(cur.targetRoas);
  const prevT = prev ? parseTarget(prev.targetRoas) : null;
  if (curT !== null) {
    if (prevT === null) {
      parts.push(`Target ROAS ${fmtTarget(curT)}`);
      changed = changed || Boolean(prev);
    } else if (curT > prevT) {
      parts.push(`Target ROAS dinaikkan ke ${fmtTarget(curT)}`);
      changed = true;
    } else if (curT < prevT) {
      parts.push(`Target ROAS diturunkan ke ${fmtTarget(curT)}`);
      changed = true;
    } else {
      parts.push(`Target ROAS tetap ${fmtTarget(curT)}`);
    }
  }

  const curM = num(cur.modalHarian);
  const prevM = prev ? num(prev.modalHarian) : 0;
  if (curM > 0) {
    if (!prev || prevM === 0) {
      parts.push(`modal harian ${rupiah(curM)}`);
    } else if (curM > prevM) {
      parts.push(`modal harian naik menjadi ${rupiah(curM)}`);
      changed = true;
    } else if (curM < prevM) {
      parts.push(`modal harian turun menjadi ${rupiah(curM)}`);
      changed = true;
    } else {
      parts.push('modal harian tetap');
    }
  }

  if (parts.length === 0) return { text: 'Tidak ada Target ROAS / modal harian yang diisi', changed: false };
  const joined = parts.join(', ');
  const text = !changed && prev ? `Stay (${joined})` : joined.charAt(0).toUpperCase() + joined.slice(1);
  return { text, changed };
}

function compareRows(curRows: any[], prevRows: any[]): CompareLine[] {
  const prevByKey = new Map<string, any>();
  prevRows.forEach((r, i) => {
    const k = rowKey(r, i);
    if (!prevByKey.has(k)) prevByKey.set(k, r);
  });

  return curRows.map((r, i) => {
    const prev = prevByKey.get(rowKey(r, i)) ?? null;
    const label = String(r?.iklanProduk ?? r?.infoIklan ?? '').trim() || `Baris ${i + 1}`;
    return { label, ...describeRow(r, prev) };
  });
}

/** Per section (Inkubasi, each Iklan Group, Mandiri): what changed since the previous session. */
export function compareSessions(current: SessionData, previous: SessionData | null): CompareSection[] {
  const rowsOf = (raw: any) => (Array.isArray(raw) ? raw : []).filter(hasData);
  const sections: CompareSection[] = [];

  const ink = rowsOf(current.data_inkubasi);
  if (ink.length) sections.push({ title: 'Inkubasi', lines: compareRows(ink, previous ? rowsOf(previous.data_inkubasi) : []) });

  const groupsNow = normalizeGroup(current.data_group).filter(hasData);
  const groupsPrev = previous ? normalizeGroup(previous.data_group).filter(hasData) : [];
  const keys = Array.from(new Set(groupsNow.map((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}`)));
  for (const key of keys) {
    const [category, name] = key.split('|');
    const now = groupsNow.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key);
    const before = groupsPrev.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key);
    sections.push({ title: `Iklan Group · ${name}${category ? ` (${category})` : ''}`, lines: compareRows(now, before) });
  }

  const man = rowsOf(current.data_mandiri);
  if (man.length) sections.push({ title: 'Mandiri', lines: compareRows(man, previous ? rowsOf(previous.data_mandiri) : []) });

  return sections;
}

/** "Rp 561,981" (as typed) -> "Rp 561.981" (as shown in reports); null when empty. */
export function saldoDisplay(raw: string | null | undefined): string | null {
  const n = num(raw);
  return n > 0 ? rupiah(n) : null;
}

/** "Sesi 2 · 30 Sep 26" */
export function previousLabel(prev: { session: number; report_date: string }) {
  const { dd, mmm, yy } = splitReportDate(prev.report_date);
  return `Sesi ${prev.session} · ${dd} ${mmm} ${yy}`;
}
