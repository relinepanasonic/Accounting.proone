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

export type ChangePart = {
  kind: 'target' | 'modal';
  dir: 'up' | 'down' | 'same' | 'first';
  value: string; // "11" or "Rp 30.000"
};

/** up = raised (green), down = lowered (red), same = stay (dark grey), plain = no colour (a new ad, a sentence part). */
export type Tone = 'up' | 'down' | 'same' | 'plain';
export interface TextSegment { text: string; tone: Tone }

export interface CompareLine {
  label: string; // product name, or "Baris 1" when the row has none
  text: string; // sentence used on screen and in the PDF
  changed: boolean;
  isNew: boolean; // row did not exist in the previous session
  parts: ChangePart[];
  /** The same sentence as `text`, in pieces with their colour. */
  segments: TextSegment[];
  note: string;
}

export interface CompareSection {
  kind: 'inkubasi' | 'group' | 'mandiri';
  name: string; // "GMV Max Auto", "Group Hero 1", "Mandiri"
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

function describeRow(cur: any, prev: any | null, hasPrevious: boolean): Omit<CompareLine, 'label' | 'note'> {
  const parts: ChangePart[] = [];
  const bits: string[] = [];
  const tones: Tone[] = [];
  let changed = false;
  const isNew = hasPrevious && !prev;

  const curT = parseTarget(cur.targetRoas);
  const prevT = prev ? parseTarget(prev.targetRoas) : null;
  if (curT !== null) {
    if (prevT === null) {
      parts.push({ kind: 'target', dir: 'first', value: fmtTarget(curT) });
      bits.push(`Target ROAS ${fmtTarget(curT)}`); tones.push('plain');
    } else if (curT > prevT) {
      parts.push({ kind: 'target', dir: 'up', value: fmtTarget(curT) });
      bits.push(`Target ROAS dinaikkan ke ${fmtTarget(curT)}`); tones.push('up');
      changed = true;
    } else if (curT < prevT) {
      parts.push({ kind: 'target', dir: 'down', value: fmtTarget(curT) });
      bits.push(`Target ROAS diturunkan ke ${fmtTarget(curT)}`); tones.push('down');
      changed = true;
    } else {
      parts.push({ kind: 'target', dir: 'same', value: fmtTarget(curT) });
      bits.push(`Target ROAS tetap ${fmtTarget(curT)}`); tones.push('same');
    }
  }

  const curM = num(cur.modalHarian);
  const prevM = prev ? num(prev.modalHarian) : 0;
  if (curM > 0) {
    if (!prev || prevM === 0) {
      parts.push({ kind: 'modal', dir: 'first', value: rupiah(curM) });
      bits.push(`modal harian ${rupiah(curM)}`); tones.push('plain');
    } else if (curM > prevM) {
      parts.push({ kind: 'modal', dir: 'up', value: rupiah(curM) });
      bits.push(`modal harian naik menjadi ${rupiah(curM)}`); tones.push('up');
      changed = true;
    } else if (curM < prevM) {
      parts.push({ kind: 'modal', dir: 'down', value: rupiah(curM) });
      bits.push(`modal harian turun menjadi ${rupiah(curM)}`); tones.push('down');
      changed = true;
    } else {
      parts.push({ kind: 'modal', dir: 'same', value: rupiah(curM) });
      bits.push('modal harian tetap'); tones.push('same');
    }
  }

  if (isNew) changed = true;

  if (bits.length === 0) return { text: 'Tidak ada Target ROAS / modal harian yang diisi', changed: false, isNew, parts, segments: [{ text: 'Tidak ada Target ROAS / modal harian yang diisi', tone: 'same' }] };
  const joined = bits.join(', ');
  const text = isNew
    ? `Baru · ${joined}`
    : !changed && hasPrevious
      ? `Stay (${joined})`
      : joined.charAt(0).toUpperCase() + joined.slice(1);
  // the same sentence in coloured pieces: up green, down red, stay dark grey
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  let segments: TextSegment[];
  if (isNew) {
    segments = [{ text: 'Baru · ', tone: 'plain' }, ...bits.flatMap((b, i) => [...(i ? [{ text: ', ', tone: 'plain' as Tone }] : []), { text: b, tone: 'plain' as Tone }])];
  } else if (!changed && hasPrevious) {
    segments = [{ text: `Stay (${joined})`, tone: 'same' }];
  } else {
    segments = bits.flatMap((b, i) => [...(i ? [{ text: ', ', tone: 'plain' as Tone }] : []), { text: i ? b : cap(b), tone: tones[i] }]);
  }
  return { text, changed, isNew, parts, segments };
}

/** Colours of the change sentences: on the white PDF / report, and on the dark screen. */
export const TONE_PDF: Record<Tone, string> = { up: '#15803d', down: '#dc2626', same: '#4b5563', plain: '#111827' };
export const TONE_DARK: Record<Tone, string> = { up: 'text-emerald-400', down: 'text-red-400', same: 'text-zinc-400', plain: 'text-zinc-100' };

function compareRows(curRows: any[], prevRows: any[], hasPrevious: boolean): CompareLine[] {
  const prevByKey = new Map<string, any>();
  prevRows.forEach((r, i) => {
    const k = rowKey(r, i);
    if (!prevByKey.has(k)) prevByKey.set(k, r);
  });

  return curRows.map((r, i) => {
    const prev = prevByKey.get(rowKey(r, i)) ?? null;
    const label = String(r?.iklanProduk ?? r?.infoIklan ?? '').trim() || `Baris ${i + 1}`;
    return { label, note: String(r?.note ?? '').trim(), ...describeRow(r, prev, hasPrevious) };
  });
}

// ---- the table cells and the numbers of a section against the session before

export type Dir = 'up' | 'down' | 'same' | 'first';
export interface RowDir { modal: Dir | null; target: Dir | null }

/** For each row: did its Modal Harian / Target ROAS go up, down or stay since the previous session? (rows are matched by name, else by position) */
export function rowDirs(curRows: any[], prevRows: any[] | null): RowDir[] {
  if (!prevRows) return curRows.map(() => ({ modal: null, target: null }));
  const prevByKey = new Map<string, any>();
  prevRows.forEach((r, i) => { const k = rowKey(r, i); if (!prevByKey.has(k)) prevByKey.set(k, r); });
  return curRows.map((r, i) => {
    const p = prevByKey.get(rowKey(r, i));
    if (!p) return { modal: null, target: null };
    const dir = (a: number | null, b: number | null): Dir | null => (a === null || b === null || a <= 0 || b <= 0 ? null : a > b ? 'up' : a < b ? 'down' : 'same');
    return { modal: dir(num(r.modalHarian), num(p.modalHarian)), target: dir(parseTarget(r.targetRoas), parseTarget(p.targetRoas)) };
  });
}

export interface Pct { dir: 'up' | 'down' | 'same'; text: string }
/** "▲ 12.5%" / "▼ 8%" / "0%" against the value before; null when there is nothing to compare with. */
export function pctChange(now: number, before: number): Pct | null {
  if (!(before > 0)) return null;
  const p = ((now - before) / before) * 100;
  if (Math.abs(p) < 0.05) return { dir: 'same', text: '0%' };
  const n = Math.abs(p) >= 100 ? String(Math.round(Math.abs(p))) : Math.abs(p).toFixed(1).replace(/\.0$/, '');
  return { dir: p > 0 ? 'up' : 'down', text: `${p > 0 ? '▲' : '▼'} ${n}%` };
}

export interface StatChanges { modal: Pct | null; biaya: Pct | null; jual: Pct | null; roas: Pct | null }
const sums = (rows: any[]) => {
  const modal = rows.reduce((t, r) => t + num(r.modalHarian), 0);
  const biaya = rows.reduce((t, r) => t + num(r.biayaIklan), 0);
  const jual = rows.reduce((t, r) => t + num(r.penjualan), 0);
  return { modal, biaya, jual, roas: biaya > 0 ? jual / biaya : 0 };
};
/** The four numbers of a section against the same section of the previous session. */
export function statChanges(curRows: any[], prevRows: any[] | null): StatChanges | null {
  if (!prevRows || !prevRows.length) return null;
  const c = sums(curRows), p = sums(prevRows);
  return { modal: pctChange(c.modal, p.modal), biaya: pctChange(c.biaya, p.biaya), jual: pctChange(c.jual, p.jual), roas: pctChange(c.roas, p.roas) };
}

/** "kemarin" (the day before), "Sesi 2" (same day) or "09 Nov". */
export function vsLabel(reportDate: string, prev: { session: number; report_date: string } | null): string {
  if (!prev) return '';
  if (prev.report_date === reportDate) return `Sesi ${prev.session}`;
  const days = Math.round((Date.parse(`${reportDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${prev.report_date.slice(0, 10)}T00:00:00Z`)) / 86400000);
  if (days === 1) return 'kemarin';
  const { dd, mmm } = splitReportDate(prev.report_date);
  return `${dd} ${mmm}`;
}

/** Per section (Inkubasi, each Iklan Group, Mandiri): what changed since the previous session. */
export function compareSessions(current: SessionData, previous: SessionData | null): CompareSection[] {
  const rowsOf = (raw: any) => (Array.isArray(raw) ? raw : []).filter(hasData);
  const hasPrevious = previous !== null;
  const sections: CompareSection[] = [];

  const ink = rowsOf(current.data_inkubasi);
  if (ink.length) {
    sections.push({ kind: 'inkubasi', name: 'GMV Max Auto', title: 'GMV Max Auto', lines: compareRows(ink, previous ? rowsOf(previous.data_inkubasi) : [], hasPrevious) });
  }

  const groupsNow = normalizeGroup(current.data_group).filter(hasData);
  const groupsPrev = previous ? normalizeGroup(previous.data_group).filter(hasData) : [];
  const keys = Array.from(new Set(groupsNow.map((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}`)));
  for (const key of keys) {
    const [category, name] = key.split('|');
    const now = groupsNow.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key);
    const before = groupsPrev.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key);
    sections.push({
      kind: 'group',
      name,
      title: `Iklan Group · ${name}${category ? ` (${category})` : ''}`,
      lines: compareRows(now, before, hasPrevious),
    });
  }

  const man = rowsOf(current.data_mandiri);
  if (man.length) {
    sections.push({ kind: 'mandiri', name: 'Mandiri', title: 'Mandiri', lines: compareRows(man, previous ? rowsOf(previous.data_mandiri) : [], hasPrevious) });
  }

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

// ---------------------------------------------------------------------------------------------
// The text that goes into WhatsApp with the file (same layout the advertiser writes by hand)
// ---------------------------------------------------------------------------------------------

const rpComma = (n: number) => `Rp ${n.toLocaleString('en-US')}`;

function messageChanges(line: CompareLine): string {
  if (line.isNew) {
    const bits = line.parts.map((p) => (p.kind === 'target' ? `Target ROAS ${p.value}` : `modal harian ${rpComma(num(p.value))}`));
    return `Baru${bits.length ? ` - ${bits.join(', ')}` : ''}`;
  }
  return line.parts
    .filter((p) => p.dir === 'up' || p.dir === 'down')
    .map((p) => {
      const verb = p.dir === 'up' ? 'Naik' : 'Turun';
      return p.kind === 'target' ? `${verb} Target ROAS menjadi ${p.value}` : `${verb} modal harian menjadi ${rpComma(num(p.value))}`;
    })
    .join(', ');
}

export function buildReportMessage(opts: {
  clientName: string;
  reportDate: string;
  session: number;
  sisaSaldo: string | null | undefined;
  sections: CompareSection[];
  hasPrevious: boolean;
}): string {
  const { dd, mmm } = splitReportDate(opts.reportDate);
  const year = opts.reportDate.slice(0, 4);
  const out: string[] = [];

  out.push(`Laporan Iklan Sesi ${opts.session}. ${dd} ${mmm} ${year} - ${opts.clientName}`);
  const saldo = num(opts.sisaSaldo);
  if (saldo > 0) out.push(`Sisa Saldo Iklan: ${rpComma(saldo)}`);

  out.push('', 'Perubahan Iklan');
  if (!opts.hasPrevious) {
    out.push('Belum ada sesi sebelumnya untuk dibandingkan.');
    return out.join('\n');
  }

  const changedLines = (section: CompareSection) => section.lines.filter((l) => l.changed);
  const main: string[] = [];
  const mandiri: string[] = [];

  for (const section of opts.sections) {
    for (const line of changedLines(section)) {
      const changes = messageChanges(line);
      if (!changes) continue;
      const product = line.label.startsWith('Baris ') ? '' : line.label;
      const note = line.note ? ` - Notes: ${line.note}` : '';
      if (section.kind === 'mandiri') {
        mandiri.push(`${product || line.label} - ${changes}${note}`);
      } else {
        const where = section.kind === 'inkubasi' ? 'GMV Max Auto' : section.name;
        main.push(`${where} - ${product ? `${product}: ` : ''}${changes}${note}`);
      }
    }
  }

  if (main.length === 0 && mandiri.length === 0) {
    out.push('Tidak ada perubahan, semua Stay.');
    return out.join('\n');
  }
  out.push(...main);
  if (mandiri.length) out.push('', 'Iklan Mandiri', ...mandiri);
  return out.join('\n');
}
