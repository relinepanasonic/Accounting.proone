/**
 * Financial statements from the ledger, in the layout of the Indonesian Financial Accounting Standards (SAK / PSAK, converged with IFRS):
 *  - Laporan Laba Rugi dan Penghasilan Komprehensif Lain (PSAK 1): by function down to operating profit, expenses by nature inside it,
 *  - Laporan Posisi Keuangan (PSAK 1): current / non-current, equity with the profit of the year shown apart,
 *  - Laporan Arus Kas (PSAK 2): indirect method, operating / investing / financing, tied to the cash accounts.
 * Every statement has a comparative column (the same period of the year before; for the balance sheet the end of the previous year) and checks.
 *
 * Pure module: no database. The caller gives the journal lines and the chart of accounts. Amounts are in Rupiah.
 */

export interface LedgerEntry { account_code: string; debit: number; credit: number; date: string; refType?: string | null }
export type CoaMap = Map<string, { name: string; type?: string }>;

export type Section =
  | 'cash' | 'receivable' | 'other_current_asset' | 'fixed_cost' | 'fixed_accum' | 'other_noncurrent_asset'
  | 'payable' | 'tax_payable' | 'other_payable' | 'noncurrent_liability'
  | 'eq_capital' | 'eq_retained' | 'eq_dividend' | 'eq_other'
  | 'revenue' | 'cogs' | 'opex_salaries' | 'opex_rent' | 'opex_utilities' | 'opex_marketing' | 'opex_professional' | 'opex_travel' | 'opex_office'
  | 'opex_bank' | 'opex_taxes' | 'opex_subscriptions' | 'opex_freight' | 'opex_other' | 'depreciation'
  | 'other_income' | 'other_expense' | 'income_tax' | 'unclassified';

interface SectionInfo { id: string; en: string; sign: 1 | -1 }
const SECTION: Record<Section, SectionInfo> = {
  cash: { id: 'Kas dan setara kas', en: 'Cash and cash equivalents', sign: 1 },
  receivable: { id: 'Piutang usaha', en: 'Trade receivables', sign: 1 },
  other_current_asset: { id: 'Aset lancar lainnya', en: 'Other current assets', sign: 1 },
  fixed_cost: { id: 'Aset tetap - harga perolehan', en: 'Property and equipment - at cost', sign: 1 },
  fixed_accum: { id: 'Akumulasi penyusutan', en: 'Accumulated depreciation', sign: 1 },
  other_noncurrent_asset: { id: 'Aset tidak lancar lainnya', en: 'Other non-current assets', sign: 1 },
  payable: { id: 'Utang usaha', en: 'Trade payables', sign: -1 },
  tax_payable: { id: 'Utang pajak', en: 'Taxes payable', sign: -1 },
  other_payable: { id: 'Utang lain-lain', en: 'Other payables', sign: -1 },
  noncurrent_liability: { id: 'Liabilitas jangka panjang', en: 'Non-current liabilities', sign: -1 },
  eq_capital: { id: 'Modal disetor', en: 'Paid-in capital', sign: -1 },
  eq_retained: { id: 'Saldo laba', en: 'Retained earnings', sign: -1 },
  eq_dividend: { id: 'Dividen', en: 'Dividends', sign: -1 },
  eq_other: { id: 'Ekuitas lainnya', en: 'Other equity', sign: -1 },
  revenue: { id: 'Pendapatan usaha', en: 'Revenue', sign: -1 },
  cogs: { id: 'Beban pokok pendapatan', en: 'Cost of revenue', sign: 1 },
  opex_salaries: { id: 'Beban gaji dan tunjangan', en: 'Salaries, wages and benefits', sign: 1 },
  opex_rent: { id: 'Beban sewa', en: 'Rent and lease', sign: 1 },
  opex_utilities: { id: 'Beban utilitas dan telekomunikasi', en: 'Utilities and telecommunications', sign: 1 },
  opex_marketing: { id: 'Beban pemasaran dan iklan', en: 'Marketing and advertising', sign: 1 },
  opex_professional: { id: 'Beban jasa profesional', en: 'Professional fees', sign: 1 },
  opex_travel: { id: 'Beban perjalanan dinas, makan dan jamuan', en: 'Travel, meals and entertainment', sign: 1 },
  opex_office: { id: 'Beban perlengkapan kantor dan pemeliharaan', en: 'Office supplies, repairs and maintenance', sign: 1 },
  opex_bank: { id: 'Beban administrasi bank', en: 'Bank charges', sign: 1 },
  opex_taxes: { id: 'Beban pajak dan perizinan', en: 'Taxes and licences', sign: 1 },
  opex_subscriptions: { id: 'Beban langganan dan iuran', en: 'Subscriptions and dues', sign: 1 },
  opex_freight: { id: 'Beban pengiriman', en: 'Delivery and freight', sign: 1 },
  opex_other: { id: 'Beban usaha lainnya', en: 'Other operating expenses', sign: 1 },
  depreciation: { id: 'Beban penyusutan', en: 'Depreciation expense', sign: 1 },
  other_income: { id: 'Penghasilan lain-lain', en: 'Other income', sign: -1 },
  other_expense: { id: 'Beban lain-lain', en: 'Other expenses', sign: 1 },
  income_tax: { id: 'Beban pajak penghasilan', en: 'Income tax expense', sign: 1 },
  unclassified: { id: 'Akun belum diklasifikasi', en: 'Unclassified accounts', sign: 1 },
};

const OPEX: Section[] = ['opex_salaries', 'opex_rent', 'opex_utilities', 'opex_marketing', 'opex_professional', 'opex_travel', 'opex_office', 'opex_bank', 'opex_taxes', 'opex_subscriptions', 'opex_freight', 'opex_other'];

const num = (code: string) => (/^\d+$/.test(code) ? Number(code) : NaN);
/** Two decimals, and never a negative zero. */
const r2 = (n: number) => Math.round(n * 100) / 100 + 0;
const test = (re: RegExp, s: string) => re.test(s.toLowerCase());

/** The statement line an account belongs to. refType 'depreciation' marks the expense side of the asset schedule, wherever it was booked. */
export function classify(code: string, name: string, refType?: string | null): Section {
  const n = num(code);
  const nm = name || '';
  if (refType === 'depreciation' && (n >= 5000 || !Number.isFinite(n)) && !test(/accumulated|akumulasi/, nm)) return 'depreciation';
  if (!Number.isFinite(n)) return 'unclassified';
  if (n < 2000) {
    if (n < 1100) return test(/receivable|piutang/, nm) ? 'receivable' : 'cash'; // 1005 "Accounts Receivable" sits in the cash range of one chart
    if (n < 1200) return 'receivable';
    if (n < 1300) return test(/accumulated|akumulasi/, nm) || code === '1202' ? 'fixed_accum' : 'fixed_cost';
    if (n < 1500) return 'other_current_asset';
    return 'other_noncurrent_asset';
  }
  if (n < 3000) {
    if (n >= 2400) return 'noncurrent_liability';
    if (code === '2002' || test(/tax|pajak|ppn|pph/, nm)) return 'tax_payable';
    if (n < 2002) return 'payable';
    return 'other_payable';
  }
  if (n < 4000) {
    if (test(/dividen|dividend|withdraw|prive/, nm) || code === '3002') return 'eq_dividend';
    if (test(/capital|modal/, nm) || code === '3001') return 'eq_capital';
    if (code === '3000' || test(/retained|saldo laba|laba ditahan/, nm)) return 'eq_retained';
    return 'eq_other';
  }
  if (n < 5000) {
    if (n >= 4100 && test(/bunga|interest|inter-?company|antar/, nm)) return 'other_income';
    return 'revenue'; // 4000-4099 and "Direct Income" (income without an invoice) are operating revenue
  }
  if (n < 6000) return 'cogs';
  if (n < 7000) {
    if (code === '6150' || test(/pajak bunga|tax on interest/, nm)) return 'other_expense';
    if (test(/inter-?company|antar perusahaan/, nm)) return 'other_expense';
    if (test(/depreciation|penyusutan|amortization|amortisasi/, nm)) return 'depreciation';
    if (test(/income tax|pajak penghasilan|pph badan/, nm)) return 'income_tax';
    if (['6001', '6010', '6060'].includes(code) || test(/salar|gaji|wage|tunjangan|bonus/, nm)) return 'opex_salaries';
    if (['6002', '6020'].includes(code) || test(/rent|sewa|lease/, nm)) return 'opex_rent';
    if (['6003', '6030', '6031', '6032'].includes(code) || test(/utilit|internet|telecom|water|electric|listrik/, nm)) return 'opex_utilities';
    if (['6004', '6080'].includes(code) || test(/marketing|advertis|iklan|meta/, nm)) return 'opex_marketing';
    if (code === '6070' || test(/profession|legal|jasa/, nm)) return 'opex_professional';
    if (['6005', '6090'].includes(code) || test(/travel|meal|entertain|perjalanan|jamuan/, nm)) return 'opex_travel';
    if (['6040', '6050'].includes(code) || test(/office|supplies|repair|maint|perlengkapan/, nm)) return 'opex_office';
    if (['6006', '6110'].includes(code) || test(/bank (admin|fee|charge)|admin bank/, nm)) return 'opex_bank';
    if (['6007', '6140'].includes(code) || test(/licen|perizinan|taxes/, nm)) return 'opex_taxes';
    if (code === '6120' || test(/subscri|dues|langganan|iuran/, nm)) return 'opex_subscriptions';
    if (code === '6160' || test(/ongkir|freight|shipping|pengiriman/, nm)) return 'opex_freight';
    return 'opex_other';
  }
  if (n < 8000) return 'other_income';
  if (n < 9000) return 'other_expense';
  return 'income_tax';
}

export interface AccountAmount { code: string; name: string; amount: number }
export interface SectionTotal { total: number; accounts: AccountAmount[] }
type Totals = Map<Section, SectionTotal>;

/** Totals per section (natural sign: assets and expenses by debit, the rest by credit) for the entries chosen by `pick`. */
function totalsOf(entries: LedgerEntry[], coa: CoaMap, pick: (e: LedgerEntry) => boolean): Totals {
  const byKey = new Map<string, { code: string; name: string; section: Section; net: number }>();
  for (const e of entries) {
    if (!pick(e)) continue;
    const name = coa.get(e.account_code)?.name || e.account_code;
    const section = classify(e.account_code, name, e.refType);
    const key = `${e.account_code}|${section}`;
    const cur = byKey.get(key) || { code: e.account_code, name: section === 'depreciation' && !test(/depreciation|penyusutan/, name) ? 'Depreciation & Amortization' : name, section, net: 0 };
    cur.net += Number(e.debit || 0) - Number(e.credit || 0);
    byKey.set(key, cur);
  }
  const out: Totals = new Map();
  for (const a of byKey.values()) {
    const amount = r2(a.net * SECTION[a.section].sign);
    if (Math.abs(amount) < 0.005) continue;
    const t = out.get(a.section) || { total: 0, accounts: [] };
    t.total = r2(t.total + amount);
    t.accounts.push({ code: a.code, name: a.name, amount });
    out.set(a.section, t);
  }
  for (const t of out.values()) t.accounts.sort((x, y) => x.code.localeCompare(y.code));
  return out;
}
const amt = (t: Totals, s: Section) => t.get(s)?.total || 0;

// ---------------------------------------------------------------- dates

const pad = (n: number) => String(n).padStart(2, '0');
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** The same calendar day one year earlier (29 Feb becomes 28 Feb). */
export function yearBefore(date: string): string {
  const y = Number(date.slice(0, 4)) - 1; const m = Number(date.slice(5, 7)); const d = Math.min(Number(date.slice(8, 10)), daysInMonth(y, m));
  return `${y}-${pad(m)}-${pad(d)}`;
}
export const dayBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const MONTH_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dateId = (d: string) => `${Number(d.slice(8, 10))} ${MONTH_ID[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
export const dateEn = (d: string) => `${Number(d.slice(8, 10))} ${MONTH_EN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

// ---------------------------------------------------------------- statement shape

export interface StmtLine {
  id: string;
  label: string;
  labelEn?: string;
  level: 0 | 1 | 2 | 3;
  kind: 'heading' | 'line' | 'account' | 'subtotal' | 'total';
  amount?: number;
  compare?: number;
  code?: string;
}
export interface Check { ok: boolean; id: string; en: string; detail?: string }
export interface Statement {
  kind: 'pl' | 'bs' | 'cf';
  titleId: string; titleEn: string;
  periodId: string; periodEn: string;
  entity: string;
  currentLabel: string; compareLabel: string;
  lines: StmtLine[];
  checks: Check[];
  warnings: string[];
}
export interface StatementInput { entries: LedgerEntry[]; coa: CoaMap; entity: string; from: string; to: string }

class Builder {
  lines: StmtLine[] = [];
  heading(id: string, label: string, labelEn: string, level: 0 | 1 = 0) { this.lines.push({ id, label, labelEn, level, kind: 'heading' }); }
  line(id: string, label: string, labelEn: string, amount: number, compare: number, level: 1 | 2 = 1, kind: 'line' | 'subtotal' | 'total' = 'line') { this.lines.push({ id, label, labelEn, level, kind, amount: r2(amount), compare: r2(compare) }); }
  accounts(prefix: string, cur: Totals, cmp: Totals, section: Section, sign = 1) {
    const codes = new Map<string, { name: string; c: number; p: number }>();
    for (const a of cur.get(section)?.accounts || []) codes.set(a.code, { name: a.name, c: a.amount * sign, p: 0 });
    for (const a of cmp.get(section)?.accounts || []) { const x = codes.get(a.code) || { name: a.name, c: 0, p: 0 }; x.p = a.amount * sign; codes.set(a.code, x); }
    for (const [code, a] of Array.from(codes.entries()).sort(([x], [y]) => x.localeCompare(y))) {
      this.lines.push({ id: `${prefix}-${code}`, label: a.name, level: 3, kind: 'account', amount: r2(a.c), compare: r2(a.p), code });
    }
  }
}

// ---------------------------------------------------------------- profit and loss

interface Pl { revenue: number; cogs: number; gross: number; opex: number; depreciation: number; operating: number; otherIncome: number; otherExpense: number; pbt: number; tax: number; net: number }
function plOf(t: Totals): Pl {
  const revenue = amt(t, 'revenue'); const cogs = amt(t, 'cogs');
  const opex = OPEX.reduce((s, k) => s + amt(t, k), 0); const depreciation = amt(t, 'depreciation');
  const gross = revenue - cogs; const operating = gross - opex - depreciation;
  const otherIncome = amt(t, 'other_income'); const otherExpense = amt(t, 'other_expense') + amt(t, 'unclassified');
  const pbt = operating + otherIncome - otherExpense; const tax = amt(t, 'income_tax');
  return { revenue, cogs, gross, opex, depreciation, operating, otherIncome, otherExpense, pbt, tax, net: pbt - tax };
}
/** A profit-and-loss line: account code 4000 and up, or a code that is not a number (kept in other expenses so that nothing is lost). */
function isPlEntry(e: LedgerEntry) {
  const n = num(e.account_code);
  return Number.isFinite(n) ? n >= 4000 : true;
}

function periodTotals(entries: LedgerEntry[], coa: CoaMap, from: string, to: string): Totals {
  return totalsOf(entries, coa, (e) => e.date >= from && e.date <= to && isPlEntry(e));
}

export function profitAndLoss(input: StatementInput): Statement {
  const { entries, coa, entity, from, to } = input;
  const cur = periodTotals(entries, coa, from, to);
  const pf = yearBefore(from); const pt = yearBefore(to);
  const cmp = periodTotals(entries, coa, pf, pt);
  const c = plOf(cur); const p = plOf(cmp);
  const b = new Builder();

  b.heading('rev', 'PENDAPATAN USAHA', 'REVENUE');
  b.accounts('rev', cur, cmp, 'revenue', 1);
  b.line('rev-total', 'Total pendapatan usaha', 'Total revenue', c.revenue, p.revenue, 1, 'subtotal');

  b.heading('cogs', 'BEBAN POKOK PENDAPATAN', 'COST OF REVENUE');
  b.accounts('cogs', cur, cmp, 'cogs', 1);
  b.line('cogs-total', 'Total beban pokok pendapatan', 'Total cost of revenue', c.cogs, p.cogs, 1, 'subtotal');
  b.line('gross', 'LABA BRUTO', 'GROSS PROFIT', c.gross, p.gross, 1, 'total');

  b.heading('opex', 'BEBAN USAHA', 'OPERATING EXPENSES');
  for (const k of [...OPEX, 'depreciation' as Section]) {
    if (!amt(cur, k) && !amt(cmp, k)) continue;
    b.line(`opex-${k}`, SECTION[k].id, SECTION[k].en, amt(cur, k), amt(cmp, k), 2);
  }
  b.line('opex-total', 'Total beban usaha', 'Total operating expenses', c.opex + c.depreciation, p.opex + p.depreciation, 1, 'subtotal');
  b.line('operating', 'LABA USAHA', 'OPERATING PROFIT', c.operating, p.operating, 1, 'total');

  b.heading('other', 'PENGHASILAN (BEBAN) LAIN-LAIN', 'OTHER INCOME (EXPENSES)');
  b.line('other-income', 'Penghasilan lain-lain (termasuk bunga bank)', 'Other income (including bank interest)', c.otherIncome, p.otherIncome, 2);
  b.line('other-expense', 'Beban lain-lain', 'Other expenses', -c.otherExpense, -p.otherExpense, 2);
  b.line('other-total', 'Total penghasilan (beban) lain-lain, neto', 'Total other income (expenses), net', c.otherIncome - c.otherExpense, p.otherIncome - p.otherExpense, 1, 'subtotal');
  b.line('pbt', 'LABA SEBELUM PAJAK PENGHASILAN', 'PROFIT BEFORE INCOME TAX', c.pbt, p.pbt, 1, 'total');
  b.line('tax', 'Beban pajak penghasilan', 'Income tax expense', -c.tax, -p.tax, 1);
  b.line('net', 'LABA BERSIH PERIODE BERJALAN', 'PROFIT FOR THE PERIOD', c.net, p.net, 1, 'total');
  b.heading('oci', 'PENGHASILAN KOMPREHENSIF LAIN', 'OTHER COMPREHENSIVE INCOME');
  b.line('oci-total', 'Penghasilan komprehensif lain, setelah pajak', 'Other comprehensive income, net of tax', 0, 0, 2);
  b.line('tci', 'TOTAL LABA KOMPREHENSIF PERIODE BERJALAN', 'TOTAL COMPREHENSIVE INCOME FOR THE PERIOD', c.net, p.net, 1, 'total');

  const warnings: string[] = [];
  const un = cur.get('unclassified');
  if (un?.accounts.length) warnings.push(`Akun tanpa kode angka dimasukkan ke beban lain-lain: ${un.accounts.map((a) => a.code).join(', ')}. / Accounts without a numeric code were put in other expenses.`);
  return {
    kind: 'pl', titleId: 'LAPORAN LABA RUGI DAN PENGHASILAN KOMPREHENSIF LAIN', titleEn: 'STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME',
    periodId: `Untuk periode ${dateId(from)} sampai dengan ${dateId(to)}`, periodEn: `For the period ${dateEn(from)} to ${dateEn(to)}`,
    entity, currentLabel: shortRange(from, to), compareLabel: shortRange(pf, pt), lines: b.lines,
    checks: [{ ok: Math.abs(c.gross - (c.revenue - c.cogs)) < 0.01 && Math.abs(c.net - (c.pbt - c.tax)) < 0.01, id: 'Laba bersih = pendapatan - beban', en: 'Profit = revenue - expenses' }],
    warnings,
  };
}
const shortRange = (a: string, b: string) => `${a.slice(8, 10)}/${a.slice(5, 7)}/${a.slice(0, 4)} - ${b.slice(8, 10)}/${b.slice(5, 7)}/${b.slice(0, 4)}`;

// ---------------------------------------------------------------- balance sheet

interface Bs { cash: number; receivable: number; otherCurrent: number; fixedCost: number; fixedAccum: number; otherNonCurrent: number; currentAssets: number; fixedNet: number; nonCurrentAssets: number; assets: number;
  payable: number; taxPayable: number; otherPayable: number; currentLiab: number; nonCurrentLiab: number; liabilities: number;
  capital: number; retainedAccount: number; priorEarnings: number; dividend: number; other: number; currentEarnings: number; equity: number; liabEquity: number }

function bsTotals(entries: LedgerEntry[], coa: CoaMap, asOf: string): { bs: Totals; prior: Totals; year: Totals } {
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  return {
    bs: totalsOf(entries, coa, (e) => e.date <= asOf && !isPlEntry(e)),
    // no closing entries are posted: the profit of the years before is added to the equity here
    prior: totalsOf(entries, coa, (e) => e.date < yearStart && isPlEntry(e)),
    year: totalsOf(entries, coa, (e) => e.date >= yearStart && e.date <= asOf && isPlEntry(e)),
  };
}
function bsOf(x: { bs: Totals; prior: Totals; year: Totals }): Bs {
  const t = x.bs;
  const cash = amt(t, 'cash'); const receivable = amt(t, 'receivable'); const otherCurrent = amt(t, 'other_current_asset');
  const fixedCost = amt(t, 'fixed_cost'); const fixedAccum = amt(t, 'fixed_accum'); const otherNonCurrent = amt(t, 'other_noncurrent_asset');
  const currentAssets = cash + receivable + otherCurrent;
  // accumulated depreciation is a credit balance inside the asset side: its natural (debit) amount is negative
  const net = fixedCost + fixedAccum;
  const nonCurrentAssets = net + otherNonCurrent; const assets = currentAssets + nonCurrentAssets;
  const payable = amt(t, 'payable'); const taxPayable = amt(t, 'tax_payable'); const otherPayable = amt(t, 'other_payable'); const nonCurrentLiab = amt(t, 'noncurrent_liability');
  const currentLiab = payable + taxPayable + otherPayable; const liabilities = currentLiab + nonCurrentLiab;
  const capital = amt(t, 'eq_capital'); const retainedAccount = amt(t, 'eq_retained'); const dividend = amt(t, 'eq_dividend'); const other = amt(t, 'eq_other');
  const priorEarnings = plOf(x.prior).net; const currentEarnings = plOf(x.year).net;
  const equity = capital + retainedAccount + priorEarnings + dividend + other + currentEarnings;
  return { cash, receivable, otherCurrent, fixedCost, fixedAccum, otherNonCurrent, currentAssets, fixedNet: net, nonCurrentAssets, assets, payable, taxPayable, otherPayable, currentLiab, nonCurrentLiab, liabilities, capital, retainedAccount, priorEarnings, dividend, other, currentEarnings, equity, liabEquity: liabilities + equity };
}

export function balanceSheet(input: StatementInput): Statement {
  const { entries, coa, entity, to } = input;
  const compareDate = `${Number(to.slice(0, 4)) - 1}-12-31`;
  const cx = bsTotals(entries, coa, to); const px = bsTotals(entries, coa, compareDate);
  const c = bsOf(cx); const p = bsOf(px);
  const b = new Builder();

  b.heading('assets', 'ASET', 'ASSETS');
  b.heading('ca', 'Aset lancar', 'Current assets', 1);
  for (const [k, id] of [['cash', 'ca-cash'], ['receivable', 'ca-rec'], ['other_current_asset', 'ca-other']] as Array<[Section, string]>) {
    if (!amt(cx.bs, k) && !amt(px.bs, k)) continue;
    b.line(id, SECTION[k].id, SECTION[k].en, amt(cx.bs, k), amt(px.bs, k), 2);
    b.accounts(id, cx.bs, px.bs, k);
  }
  b.line('ca-total', 'Total aset lancar', 'Total current assets', c.currentAssets, p.currentAssets, 1, 'subtotal');
  b.heading('nca', 'Aset tidak lancar', 'Non-current assets', 1);
  if (c.fixedCost || p.fixedCost || c.fixedAccum || p.fixedAccum) {
    b.line('fa-cost', 'Aset tetap - harga perolehan', 'Property and equipment - at cost', c.fixedCost, p.fixedCost, 2);
    b.accounts('fa-cost', cx.bs, px.bs, 'fixed_cost');
    b.line('fa-accum', 'Akumulasi penyusutan', 'Accumulated depreciation', c.fixedAccum, p.fixedAccum, 2);
    b.line('fa-net', 'Aset tetap - neto', 'Property and equipment - net', c.fixedNet, p.fixedNet, 2, 'subtotal');
  }
  if (c.otherNonCurrent || p.otherNonCurrent) { b.line('nca-other', SECTION.other_noncurrent_asset.id, SECTION.other_noncurrent_asset.en, c.otherNonCurrent, p.otherNonCurrent, 2); b.accounts('nca-other', cx.bs, px.bs, 'other_noncurrent_asset'); }
  b.line('nca-total', 'Total aset tidak lancar', 'Total non-current assets', c.nonCurrentAssets, p.nonCurrentAssets, 1, 'subtotal');
  b.line('assets-total', 'TOTAL ASET', 'TOTAL ASSETS', c.assets, p.assets, 1, 'total');

  b.heading('le', 'LIABILITAS DAN EKUITAS', 'LIABILITIES AND EQUITY');
  b.heading('cl', 'Liabilitas jangka pendek', 'Current liabilities', 1);
  for (const [k, id] of [['payable', 'cl-pay'], ['tax_payable', 'cl-tax'], ['other_payable', 'cl-other']] as Array<[Section, string]>) {
    if (!amt(cx.bs, k) && !amt(px.bs, k)) continue;
    b.line(id, SECTION[k].id, SECTION[k].en, amt(cx.bs, k), amt(px.bs, k), 2);
    b.accounts(id, cx.bs, px.bs, k);
  }
  b.line('cl-total', 'Total liabilitas jangka pendek', 'Total current liabilities', c.currentLiab, p.currentLiab, 1, 'subtotal');
  b.heading('ncl', 'Liabilitas jangka panjang', 'Non-current liabilities', 1);
  if (c.nonCurrentLiab || p.nonCurrentLiab) { b.line('ncl-main', SECTION.noncurrent_liability.id, SECTION.noncurrent_liability.en, c.nonCurrentLiab, p.nonCurrentLiab, 2); b.accounts('ncl', cx.bs, px.bs, 'noncurrent_liability'); }
  b.line('ncl-total', 'Total liabilitas jangka panjang', 'Total non-current liabilities', c.nonCurrentLiab, p.nonCurrentLiab, 1, 'subtotal');
  b.line('liab-total', 'TOTAL LIABILITAS', 'TOTAL LIABILITIES', c.liabilities, p.liabilities, 1, 'total');

  b.heading('eq', 'EKUITAS', 'EQUITY');
  if (c.capital || p.capital) { b.line('eq-cap', 'Modal disetor', 'Paid-in capital', c.capital, p.capital, 2); b.accounts('eq-cap', cx.bs, px.bs, 'eq_capital'); }
  b.line('eq-ret', 'Saldo laba - ditahan (awal tahun)', 'Retained earnings (brought forward)', c.retainedAccount + c.priorEarnings, p.retainedAccount + p.priorEarnings, 2);
  if (c.dividend || p.dividend) b.line('eq-div', 'Dividen', 'Dividends', c.dividend, p.dividend, 2);
  if (c.other || p.other) b.line('eq-other', 'Ekuitas lainnya', 'Other equity', c.other, p.other, 2);
  b.line('eq-year', 'Laba tahun berjalan', 'Profit for the year', c.currentEarnings, p.currentEarnings, 2);
  b.line('eq-total', 'TOTAL EKUITAS', 'TOTAL EQUITY', c.equity, p.equity, 1, 'total');
  b.line('le-total', 'TOTAL LIABILITAS DAN EKUITAS', 'TOTAL LIABILITIES AND EQUITY', c.liabEquity, p.liabEquity, 1, 'total');

  const diff = r2(c.assets - c.liabEquity); const diffP = r2(p.assets - p.liabEquity);
  const warnings: string[] = [];
  for (const a of cx.bs.get('cash')?.accounts || []) if (a.amount < -0.5) warnings.push(`Saldo kas/bank negatif: ${a.code} ${a.name} (${Math.round(a.amount).toLocaleString('id-ID')}). / Negative cash balance.`);
  return {
    kind: 'bs', titleId: 'LAPORAN POSISI KEUANGAN', titleEn: 'STATEMENT OF FINANCIAL POSITION',
    periodId: `Pada tanggal ${dateId(to)}`, periodEn: `As at ${dateEn(to)}`,
    entity, currentLabel: dateShort(to), compareLabel: dateShort(compareDate), lines: b.lines,
    checks: [
      { ok: Math.abs(diff) < 1, id: 'Total aset = total liabilitas + ekuitas', en: 'Total assets = total liabilities + equity', detail: Math.abs(diff) < 1 ? undefined : `selisih ${diff.toLocaleString('id-ID')}` },
      { ok: Math.abs(diffP) < 1, id: 'Pembanding seimbang', en: 'Comparative balances', detail: Math.abs(diffP) < 1 ? undefined : `selisih ${diffP.toLocaleString('id-ID')}` },
    ],
    warnings,
  };
}
const dateShort = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

// ---------------------------------------------------------------- cash flow (indirect method, PSAK 2)

interface Cf { pbt: number; depreciation: number; dRec: number; dOtherCurrent: number; dPay: number; dTax: number; dOtherPay: number; incomeTax: number; otherNonCash: number; operating: number; investing: number; dFixed: number; dOtherNonCurrent: number; financing: number; dCapital: number; dEquityAccounts: number; dLongTerm: number; net: number; opening: number; closing: number; dCashActual: number }

function cfOf(entries: LedgerEntry[], coa: CoaMap, from: string, to: string): Cf {
  const open = bsOf(bsTotals(entries, coa, dayBefore(from)));
  const close = bsOf(bsTotals(entries, coa, to));
  const pl = plOf(periodTotals(entries, coa, from, to));
  const dRec = -(close.receivable - open.receivable); const dOtherCurrent = -(close.otherCurrent - open.otherCurrent);
  const dPay = close.payable - open.payable; const dTax = close.taxPayable - open.taxPayable; const dOtherPay = close.otherPayable - open.otherPayable;
  const depreciation = pl.depreciation;
  const incomeTax = -pl.tax;
  const workingCapital = dRec + dOtherCurrent + dPay + dTax + dOtherPay;
  // investing: the cost of the fixed assets and the other non-current assets
  const dFixed = -(close.fixedCost - open.fixedCost); const dOtherNonCurrent = -(close.otherNonCurrent - open.otherNonCurrent);
  const investing = dFixed + dOtherNonCurrent;
  // financing: capital, dividends and the other equity accounts, and long-term liabilities
  const dCapital = close.capital - open.capital;
  const dEquityAccounts = (close.retainedAccount + close.dividend + close.other) - (open.retainedAccount + open.dividend + open.other);
  const dLongTerm = close.nonCurrentLiab - open.nonCurrentLiab;
  const financing = dCapital + dEquityAccounts + dLongTerm;
  const dCashActual = close.cash - open.cash;
  // what the accumulated depreciation moved beyond the expense (a disposal, a correction) is a non-cash item that keeps the statement tied to the cash
  const otherNonCash = r2((close.fixedAccum - open.fixedAccum) * -1 - depreciation);
  const operating = pl.pbt + depreciation + workingCapital + incomeTax + otherNonCash;
  return { pbt: pl.pbt, depreciation, dRec, dOtherCurrent, dPay, dTax, dOtherPay, incomeTax, otherNonCash, operating, investing, dFixed, dOtherNonCurrent, financing, dCapital, dEquityAccounts, dLongTerm, net: operating + investing + financing, opening: open.cash, closing: close.cash, dCashActual };
}

export function cashFlow(input: StatementInput): Statement {
  const { entries, coa, entity, from, to } = input;
  const c = cfOf(entries, coa, from, to);
  const pf = yearBefore(from); const pt = yearBefore(to);
  const p = cfOf(entries, coa, pf, pt);
  const b = new Builder();

  b.heading('op', 'ARUS KAS DARI AKTIVITAS OPERASI', 'CASH FLOWS FROM OPERATING ACTIVITIES');
  b.line('op-pbt', 'Laba sebelum pajak penghasilan', 'Profit before income tax', c.pbt, p.pbt, 2);
  b.heading('op-adj', 'Penyesuaian untuk:', 'Adjustments for:', 1);
  b.line('op-dep', 'Beban penyusutan', 'Depreciation expense', c.depreciation, p.depreciation, 2);
  if (c.otherNonCash || p.otherNonCash) b.line('op-nc', 'Penyesuaian non-kas lainnya (akumulasi penyusutan di luar beban)', 'Other non-cash adjustments (accumulated depreciation beyond the expense)', c.otherNonCash, p.otherNonCash, 2);
  b.heading('op-wc', 'Perubahan modal kerja:', 'Changes in working capital:', 1);
  b.line('op-rec', '(Kenaikan) penurunan piutang usaha', '(Increase) decrease in trade receivables', c.dRec, p.dRec, 2);
  b.line('op-oca', '(Kenaikan) penurunan aset lancar lainnya', '(Increase) decrease in other current assets', c.dOtherCurrent, p.dOtherCurrent, 2);
  b.line('op-pay', 'Kenaikan (penurunan) utang usaha', 'Increase (decrease) in trade payables', c.dPay, p.dPay, 2);
  b.line('op-tax', 'Kenaikan (penurunan) utang pajak', 'Increase (decrease) in taxes payable', c.dTax, p.dTax, 2);
  b.line('op-opay', 'Kenaikan (penurunan) utang lain-lain', 'Increase (decrease) in other payables', c.dOtherPay, p.dOtherPay, 2);
  b.line('op-gen', 'Kas yang dihasilkan dari operasi', 'Cash generated from operations', c.operating - c.incomeTax, p.operating - p.incomeTax, 1, 'subtotal');
  b.line('op-paid', 'Pembayaran pajak penghasilan', 'Income tax paid', c.incomeTax, p.incomeTax, 2);
  b.line('op-total', 'Kas neto diperoleh dari (digunakan untuk) aktivitas operasi', 'Net cash provided by (used in) operating activities', c.operating, p.operating, 1, 'total');

  b.heading('inv', 'ARUS KAS DARI AKTIVITAS INVESTASI', 'CASH FLOWS FROM INVESTING ACTIVITIES');
  b.line('inv-fa', 'Perolehan aset tetap', 'Acquisition of property and equipment', c.dFixed, p.dFixed, 2);
  if (c.dOtherNonCurrent || p.dOtherNonCurrent) b.line('inv-o', 'Aset tidak lancar lainnya', 'Other non-current assets', c.dOtherNonCurrent, p.dOtherNonCurrent, 2);
  b.line('inv-total', 'Kas neto digunakan untuk aktivitas investasi', 'Net cash used in investing activities', c.investing, p.investing, 1, 'total');

  b.heading('fin', 'ARUS KAS DARI AKTIVITAS PENDANAAN', 'CASH FLOWS FROM FINANCING ACTIVITIES');
  b.line('fin-cap', 'Penerimaan (pengembalian) modal disetor', 'Proceeds from (repayment of) paid-in capital', c.dCapital, p.dCapital, 2);
  b.line('fin-div', 'Pembayaran dividen dan penarikan ekuitas lainnya', 'Dividends paid and other equity movements', c.dEquityAccounts, p.dEquityAccounts, 2);
  if (c.dLongTerm || p.dLongTerm) b.line('fin-lt', 'Penerimaan (pembayaran) liabilitas jangka panjang', 'Proceeds from (repayment of) non-current liabilities', c.dLongTerm, p.dLongTerm, 2);
  b.line('fin-total', 'Kas neto diperoleh dari (digunakan untuk) aktivitas pendanaan', 'Net cash provided by (used in) financing activities', c.financing, p.financing, 1, 'total');

  b.line('net', 'KENAIKAN (PENURUNAN) NETO KAS DAN SETARA KAS', 'NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS', c.net, p.net, 1, 'total');
  b.line('open', 'Kas dan setara kas pada awal periode', 'Cash and cash equivalents at the beginning of the period', c.opening, p.opening, 1);
  b.line('close', 'KAS DAN SETARA KAS PADA AKHIR PERIODE', 'CASH AND CASH EQUIVALENTS AT THE END OF THE PERIOD', c.opening + c.net, p.opening + p.net, 1, 'total');

  const diff = r2(c.closing - (c.opening + c.net)); const diffP = r2(p.closing - (p.opening + p.net));
  const warnings: string[] = [];
  if (Math.abs(c.otherNonCash) > 0.5) warnings.push('Akumulasi penyusutan bergerak berbeda dari beban penyusutan periode ini. / Accumulated depreciation moved differently from the depreciation expense.');
  return {
    kind: 'cf', titleId: 'LAPORAN ARUS KAS', titleEn: 'STATEMENT OF CASH FLOWS',
    periodId: `Untuk periode ${dateId(from)} sampai dengan ${dateId(to)} (metode tidak langsung)`, periodEn: `For the period ${dateEn(from)} to ${dateEn(to)} (indirect method)`,
    entity, currentLabel: shortRange(from, to), compareLabel: shortRange(pf, pt), lines: b.lines,
    checks: [
      { ok: Math.abs(diff) < 1, id: 'Kas akhir menurut arus kas = saldo kas di neraca', en: 'Closing cash per cash flow = cash on the balance sheet', detail: Math.abs(diff) < 1 ? undefined : `selisih ${diff.toLocaleString('id-ID')}` },
      { ok: Math.abs(diffP) < 1, id: 'Pembanding sesuai', en: 'Comparative agrees', detail: Math.abs(diffP) < 1 ? undefined : `selisih ${diffP.toLocaleString('id-ID')}` },
    ],
    warnings,
  };
}
