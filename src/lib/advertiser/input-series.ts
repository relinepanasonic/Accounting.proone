// What the advertisers typed in the Input Log (advertiser_reports), turned into numbers per day. Pure module.
//
// A client has up to 3 sessions a day:
//  - Session 1 holds the Penjualan and Biaya Iklan of YESTERDAY (Shopee's closed day), so they count for the day before the report.
//  - The last session of the day (2 or 3, or 1 when it is the only one) holds the placement the advertiser left for that day:
//    its Modal Harian and Target ROAS count for the report day itself.
// Rows of all three blocks count: Iklan Produk Otomatis (data_inkubasi), Group (data_group) and Mandiri (data_mandiri).

export interface InputReport { client_id: string; report_date: string; session: number; data_inkubasi?: any; data_group?: any; data_mandiri?: any }

export interface InputDay {
  /** Daily budget set that day (last session). */
  modal: number;
  /** Target ROAS weighted by the budget of each ad: sum(target x modal) and sum(modal) of the ads with a target. */
  targetW: number;
  targetWeight: number;
  /** Spend and sales of the day (session 1 of the next day). */
  biaya: number;
  penjualan: number;
}

/** "Rp 1,597,487" -> 1597487. */
export const money = (v: unknown) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
/** "11.5" / "11,5" -> 11.5; "Auto" or empty -> 0. */
export const decimal = (v: unknown) => { const n = Number(String(v ?? '').trim().replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };

const rowsOf = (r: InputReport): any[] => [r.data_inkubasi, r.data_group, r.data_mandiri].flatMap((b) => (Array.isArray(b) ? b : []));

const dayBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

export const emptyDay = (): InputDay => ({ modal: 0, targetW: 0, targetWeight: 0, biaya: 0, penjualan: 0 });

/** client id -> day (yyyy-mm-dd) -> its numbers. */
export function inputByDay(reports: InputReport[]): Map<string, Map<string, InputDay>> {
  const sessions = new Map<string, InputReport[]>(); // client|date -> sessions
  for (const r of reports) {
    const k = `${r.client_id}|${r.report_date}`;
    sessions.set(k, [...(sessions.get(k) || []), r]);
  }
  const out = new Map<string, Map<string, InputDay>>();
  const day = (client: string, d: string) => {
    const m = out.get(client) || new Map<string, InputDay>();
    out.set(client, m);
    const v = m.get(d) || emptyDay();
    m.set(d, v);
    return v;
  };
  for (const list of sessions.values()) {
    list.sort((a, b) => a.session - b.session);
    const first = list[0];
    const last = list[list.length - 1];
    if (first.session === 1) {
      const y = day(first.client_id, dayBefore(first.report_date));
      for (const row of rowsOf(first)) { y.biaya += money(row?.biayaIklan); y.penjualan += money(row?.penjualan); }
    }
    const t = day(last.client_id, last.report_date);
    for (const row of rowsOf(last)) {
      const modal = money(row?.modalHarian);
      const target = decimal(row?.targetRoas);
      t.modal += modal;
      if (target > 0 && modal > 0) { t.targetW += target * modal; t.targetWeight += modal; }
    }
  }
  return out;
}

export interface InputSeries { modal: number[]; biaya: number[]; biayaBudgeted: number[]; penjualan: number[]; target: number[] }

/**
 * The days of some clients put in buckets. biayaBudgeted is the spend of the days that also have a budget, so
 * "budget used" compares like with like. target is 0 where no ad had a target.
 */
export function inputSeries(days: Array<Map<string, InputDay>>, size: number, bucket: (day: string) => number): InputSeries {
  const z = () => Array.from({ length: size }, () => 0);
  const s = { modal: z(), biaya: z(), biayaBudgeted: z(), penjualan: z(), target: z() };
  const tw = z(); const tWeight = z();
  for (const m of days) {
    for (const [d, v] of m) {
      const b = bucket(d);
      if (b < 0 || b >= size) continue;
      s.modal[b] += v.modal; s.biaya[b] += v.biaya; s.penjualan[b] += v.penjualan;
      if (v.modal > 0) s.biayaBudgeted[b] += v.biaya;
      tw[b] += v.targetW; tWeight[b] += v.targetWeight;
    }
  }
  s.target = tw.map((w, i) => (tWeight[i] > 0 ? w / tWeight[i] : 0));
  return s;
}

// ---- the calendar chart: what each ad was set to in each session of each day

/** date (yyyy-mm-dd) -> session -> ad name -> [Modal Harian, Target ROAS] (target 0 = none). */
export interface StoreCalendar { ads: string[]; cells: Record<string, Record<string, Record<string, [number, number]>>> }

const GMV_MAX = 'GMV Max';
const natural = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });

/** GMV Max first, then the Iklan Groups, then the Iklan Mandiri, each A to Z (numbers in order). */
export function calendarFromReports(reports: InputReport[]): StoreCalendar {
  const cells: StoreCalendar['cells'] = {};
  const kind = new Map<string, number>(); // ad -> 0 GMV Max, 1 group, 2 mandiri
  const rowsOfKind = (r: InputReport): Array<{ ad: string; k: number; row: any }> => {
    const out: Array<{ ad: string; k: number; row: any }> = [];
    for (const row of Array.isArray(r.data_inkubasi) ? r.data_inkubasi : []) out.push({ ad: GMV_MAX, k: 0, row });
    const g = r.data_group;
    const groupRows: any[] = Array.isArray(g) ? g : g && typeof g === 'object' ? [...(g.hero || []).map((x: any) => ({ ...x, groupName: 'Group Hero 1' })), ...(g.reguler || []).map((x: any) => ({ ...x, groupName: 'Group Reguler 1' })), ...(g.low || []).map((x: any) => ({ ...x, groupName: 'Group Low 1' }))] : [];
    for (const row of groupRows) out.push({ ad: String(row?.groupName || 'Group').trim() || 'Group', k: 1, row });
    (Array.isArray(r.data_mandiri) ? r.data_mandiri : []).forEach((row: any, i: number) => out.push({ ad: String(row?.infoIklan || '').trim() || `Mandiri ${i + 1}`, k: 2, row }));
    return out;
  };
  for (const r of reports) {
    const acc = new Map<string, { m: number; tw: number; w: number }>();
    for (const { ad, k, row } of rowsOfKind(r)) {
      const modal = money(row?.modalHarian);
      const target = decimal(row?.targetRoas);
      if (!modal && !target) continue;
      kind.set(ad, Math.min(kind.get(ad) ?? 9, k));
      const a = acc.get(ad) || { m: 0, tw: 0, w: 0 };
      a.m += modal;
      if (target > 0) { const wgt = modal > 0 ? modal : 1; a.tw += target * wgt; a.w += wgt; }
      acc.set(ad, a);
    }
    if (!acc.size) continue;
    const day = (cells[r.report_date] ||= {});
    const ses = (day[String(r.session)] ||= {});
    for (const [ad, a] of acc) ses[ad] = [a.m, a.w > 0 ? a.tw / a.w : 0];
  }
  const ads = Array.from(kind.keys()).sort((a, b) => (kind.get(a)! - kind.get(b)!) || natural(a, b));
  return { ads, cells };
}
