// OptimasiShopee: what the advertiser should do next, from one day's figures. Pure functions, no database.
// The same rules are written down in .claude/skills/OptimasiShopee/SKILL.md - keep the two identical.
import { hasData, normalizeGroup, num } from '@/lib/advertiser/report-utils';

/** Biaya iklan reached Modal harian (e.g. 25k of 25k) = "maxed out"; 99% allows for rounding. */
export const MAXED_AT = 0.99;
/** Biaya iklan below this share of Modal harian = "low" (the budget is not being used). */
export const LOW_BELOW = 0.7;

export type RecSection = 'gmv' | 'hero' | 'regular' | 'low' | 'mandiri';
export type RecTone = 'up' | 'down' | 'move' | 'delete' | 'check' | 'stay' | 'watch';

export interface Recommendation {
  section: RecSection;
  sectionLabel: string;
  name: string; // group name, product or ad
  action: string;
  tone: RecTone;
  modal: number;
  biaya: number;
  usagePct: number; // biaya as % of modal
  roas: number | null;
  avgRoas: number | null;
  streak?: number; // GMV Max Auto: how many days in a row this has been maxed out
}

/** One day of figures for one client (the last session saved that day). */
export interface DayFigures {
  date: string; // YYYY-MM-DD
  data_inkubasi: any; // stored under this key, shown to people as "GMV Max Auto"
  data_group: any;
  data_mandiri: any;
}

export const SECTION_LABEL: Record<RecSection, string> = {
  gmv: 'GMV Max Auto',
  hero: 'Group Hero',
  regular: 'Group Regular',
  low: 'Group Low Konversi',
  mandiri: 'Iklan Mandiri',
};

const GMV_ACTION = 'Check apakah ada produk yang dapat dikeluarkan dari GMV Max Auto?';

// [maxed & ROAS above avg, maxed & ROAS below avg, low & above avg, low & below avg]
type Rule = [[string, RecTone], [string, RecTone], [string, RecTone], [string, RecTone]];
const STAY: [string, RecTone] = ['STAY!', 'stay'];
const RULES: Record<Exclude<RecSection, 'gmv'>, Rule> = {
  hero: [
    ['Naikkan Modal Harian!', 'up'],
    ['Naikkan Target ROAS!', 'up'],
    ['Turunkan Target ROAS!', 'down'],
    ['Lihat Detail Produk; buang yang jelek!', 'check'],
  ],
  regular: [
    ['Pindahkan Produk yang bagus ke Group HERO!', 'move'],
    ['Naikkan Target ROAS!', 'up'],
    STAY,
    ['Pindahkan Produk Jelek ke Low Konversi!', 'move'],
  ],
  low: [STAY, ['Hapus Produk yang Boncos!', 'delete'], STAY, ['Hapus Produk yang Boncos!', 'delete']],
  mandiri: [
    ['Naikkan Modal Harian!', 'up'],
    ['Naikkan Target ROAS!', 'up'],
    ['Turunkan Target ROAS!', 'down'],
    ['Kembali ke Group Hero!', 'move'],
  ],
};

const sums = (rows: any[]) => {
  const modal = rows.reduce((s, r) => s + num(r.modalHarian), 0);
  const biaya = rows.reduce((s, r) => s + num(r.biayaIklan), 0);
  const jual = rows.reduce((s, r) => s + num(r.penjualan), 0);
  return { modal, biaya, jual, roas: biaya > 0 ? jual / biaya : null };
};

const sectionOfGroup = (g: any): RecSection => {
  const text = `${g.groupCategory || ''} ${g.groupName || ''}`.toLowerCase();
  if (text.includes('hero')) return 'hero';
  if (text.includes('low')) return 'low';
  return 'regular';
};

const rowsOf = (raw: any) => (Array.isArray(raw) ? raw : []).filter(hasData);
const rowKey = (r: any, i: number) => {
  const n = String(r?.iklanProduk ?? '').trim().toLowerCase();
  return n && n !== '-' ? `n|${n}` : `i|${i}`;
};

const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Days in a row (counting this one) that this GMV Max Auto product used up its Modal harian. */
function maxedStreak(key: string, today: DayFigures, history: DayFigures[]): number {
  const byDate = new Map(history.map((h) => [h.date, h]));
  let streak = 1;
  for (let d = addDays(today.date, -1); ; d = addDays(d, -1)) {
    const day = byDate.get(d);
    if (!day) break;
    const rows = rowsOf(day.data_inkubasi);
    const hit = rows.find((r, i) => rowKey(r, i) === key);
    if (!hit || !(num(hit.modalHarian) > 0 && num(hit.biayaIklan) / num(hit.modalHarian) >= MAXED_AT)) break;
    streak++;
  }
  return streak;
}

/** Everything the advertiser should look at for this day. `history` = earlier days of the same client. */
export function buildRecommendations(today: DayFigures, history: DayFigures[] = []): Recommendation[] {
  const out: Recommendation[] = [];

  // GMV Max Auto (stored as "inkubasi"): modal harian is usually Rp 50.000 with target ROAS Auto.
  rowsOf(today.data_inkubasi).forEach((r, i) => {
    const modal = num(r.modalHarian);
    const biaya = num(r.biayaIklan);
    if (modal <= 0 || biaya / modal < MAXED_AT) return;
    const jual = num(r.penjualan);
    out.push({
      section: 'gmv',
      sectionLabel: SECTION_LABEL.gmv,
      name: String(r.iklanProduk || '').trim() || `Baris ${i + 1}`,
      action: GMV_ACTION,
      tone: 'check',
      modal,
      biaya,
      usagePct: Math.round((biaya / modal) * 100),
      roas: biaya > 0 ? jual / biaya : null,
      avgRoas: null,
      streak: maxedStreak(rowKey(r, i), today, history),
    });
  });

  // The store's average ROAS = total sales / total ad cost across all the groups.
  const groups = normalizeGroup(today.data_group).filter(hasData);
  const mandiriRows = rowsOf(today.data_mandiri);
  const base = groups.length ? groups : [...groups, ...mandiriRows];
  const avg = sums(base).roas;

  const decide = (section: Exclude<RecSection, 'gmv'>, name: string, s: ReturnType<typeof sums>) => {
    if (s.modal <= 0) return;
    const usage = s.biaya / s.modal;
    const above = s.roas !== null && avg !== null && s.roas >= avg;
    let pick: [string, RecTone];
    if (usage >= MAXED_AT) pick = RULES[section][above ? 0 : 1];
    else if (usage < LOW_BELOW) pick = RULES[section][above ? 2 : 3];
    else pick = ['Pantau: modal terpakai cukup, belum perlu aksi.', 'watch'];
    out.push({
      section,
      sectionLabel: SECTION_LABEL[section],
      name,
      action: pick[0],
      tone: pick[1],
      modal: s.modal,
      biaya: s.biaya,
      usagePct: Math.round(usage * 100),
      roas: s.roas,
      avgRoas: avg,
    });
  };

  // One decision per group (Group Hero 1, Group Hero 2, ...).
  const names = Array.from(new Set(groups.map((g) => `${sectionOfGroup(g)}|${g.groupName || 'Group'}`)));
  for (const key of names) {
    const [section, name] = key.split('|') as [Exclude<RecSection, 'gmv' | 'mandiri'>, string];
    decide(section, name, sums(groups.filter((g) => `${sectionOfGroup(g)}|${g.groupName || 'Group'}` === key)));
  }

  // One decision per Iklan Mandiri ad.
  mandiriRows.forEach((r, i) => decide('mandiri', String(r.infoIklan || '').trim() || `Iklan ${i + 1}`, sums([r])));

  return out;
}

/** Only what needs a person to act: no STAY and no "watch". */
export const actionable = (recs: Recommendation[]) => recs.filter((r) => r.tone !== 'stay' && r.tone !== 'watch');
