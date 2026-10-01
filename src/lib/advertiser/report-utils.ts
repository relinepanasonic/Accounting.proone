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
