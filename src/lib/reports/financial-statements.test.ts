import { describe, it, expect } from 'vitest';
import { classify, profitAndLoss, balanceSheet, cashFlow, yearBefore, type LedgerEntry, type CoaMap } from './financial-statements';

const coa: CoaMap = new Map([
  ['1010', { name: 'Bank BCA' }], ['1100', { name: 'Accounts Receivable' }], ['1201', { name: 'Equipment & Hardware' }], ['1202', { name: 'Accumulated Depreciation' }],
  ['2000', { name: 'Accounts Payable' }], ['2002', { name: 'Taxes Payable' }], ['3001', { name: 'Paid-in Capital' }], ['3000', { name: 'Retained Earnings' }],
  ['4000', { name: 'Sales Revenue' }], ['4101', { name: 'Bunga Bank' }], ['5050', { name: 'Subcontractor Costs' }],
  ['6001', { name: 'Salaries & Wages' }], ['6100', { name: 'Inter-Company Transfer Out' }], ['6130', { name: 'Depreciation & Amortization' }],
]);

/** A small company: capital, equipment, sales on credit, a payment, costs, a dividend, depreciation booked on 6100 (as the asset schedule does). */
const e = (date: string, account_code: string, debit: number, credit: number, refType?: string): LedgerEntry => ({ date, account_code, debit, credit, refType });
const ledger: LedgerEntry[] = [
  // 2025: capital 100 mio in the bank, equipment 24 mio paid, a sale of 50 mio on credit, salaries 10 mio
  e('2025-03-01', '1010', 100e6, 0), e('2025-03-01', '3001', 0, 100e6),
  e('2025-04-01', '1201', 24e6, 0), e('2025-04-01', '1010', 0, 24e6),
  e('2025-06-01', '1100', 50e6, 0), e('2025-06-01', '4000', 0, 50e6),
  e('2025-07-01', '6001', 10e6, 0), e('2025-07-01', '1010', 0, 10e6),
  // 2026: the 2025 sale is paid, a new sale 80 mio (30 mio paid), costs, depreciation, interest, a dividend, tax payable
  e('2026-01-10', '1010', 50e6, 0), e('2026-01-10', '1100', 0, 50e6),
  e('2026-02-01', '1100', 80e6, 0), e('2026-02-01', '4000', 0, 80e6),
  e('2026-02-20', '1010', 30e6, 0), e('2026-02-20', '1100', 0, 30e6),
  e('2026-03-01', '5050', 20e6, 0), e('2026-03-01', '2000', 0, 20e6),
  e('2026-04-01', '2000', 15e6, 0), e('2026-04-01', '1010', 0, 15e6),
  e('2026-05-01', '6001', 12e6, 0), e('2026-05-01', '1010', 0, 12e6),
  e('2026-06-01', '6100', 2e6, 0, 'depreciation'), e('2026-06-01', '1202', 0, 2e6, 'depreciation'),
  e('2026-07-01', '1010', 1e6, 0), e('2026-07-01', '4101', 0, 1e6),
  e('2026-08-01', '1201', 6e6, 0), e('2026-08-01', '1010', 0, 6e6),
  e('2026-09-01', '3000', 5e6, 0), e('2026-09-01', '1010', 0, 5e6),
  e('2026-09-15', '6001', 3e6, 0), e('2026-09-15', '2002', 0, 3e6),
];
const input = { entries: ledger, coa, entity: 'PT Contoh', from: '2026-01-01', to: '2026-12-31' };
const line = (s: { lines: Array<{ id: string; amount?: number; compare?: number }> }, id: string) => s.lines.find((l) => l.id === id)!;

describe('classification of accounts', () => {
  it('puts the accounts on the lines of the Indonesian statements', () => {
    expect(classify('1010', 'Bank')).toBe('cash');
    expect(classify('1100', 'Accounts Receivable')).toBe('receivable');
    expect(classify('1202', 'Accumulated Depreciation')).toBe('fixed_accum');
    expect(classify('1203', 'Furniture')).toBe('fixed_cost');
    expect(classify('2002', 'Taxes Payable')).toBe('tax_payable');
    expect(classify('3001', 'Paid-in Capital')).toBe('eq_capital');
    expect(classify('4000', 'Sales')).toBe('revenue');
    expect(classify('4100', 'Direct Income')).toBe('revenue');
    expect(classify('4101', 'Bunga Bank')).toBe('other_income');
    expect(classify('5050', 'Subcontractor')).toBe('cogs');
    expect(classify('6001', 'Salaries')).toBe('opex_salaries');
    expect(classify('6150', 'Pajak Bunga Bank')).toBe('other_expense');
    expect(classify('9010', 'PPh Badan')).toBe('income_tax');
    expect(classify('Direct', 'x')).toBe('unclassified');
  });
  it('the asset schedule expense is depreciation even when it is booked on 6100', () => {
    expect(classify('6100', 'Inter-Company Transfer Out', 'depreciation')).toBe('depreciation');
    expect(classify('6100', 'Inter-Company Transfer Out')).toBe('other_expense');
  });
  it('a year earlier keeps the day, and 29 Feb becomes 28 Feb', () => {
    expect(yearBefore('2026-10-31')).toBe('2025-10-31');
    expect(yearBefore('2028-02-29')).toBe('2027-02-28');
  });
});

describe('profit and loss', () => {
  const pl = profitAndLoss(input);
  it('goes from revenue to profit for the period, with the depreciation seen apart', () => {
    expect(line(pl, 'rev-total').amount).toBe(80e6);
    expect(line(pl, 'cogs-total').amount).toBe(20e6);
    expect(line(pl, 'gross').amount).toBe(60e6);
    expect(line(pl, 'opex-opex_salaries').amount).toBe(15e6);
    expect(line(pl, 'opex-depreciation').amount).toBe(2e6);
    expect(line(pl, 'operating').amount).toBe(43e6);
    expect(line(pl, 'other-income').amount).toBe(1e6);
    expect(line(pl, 'pbt').amount).toBe(44e6);
    expect(line(pl, 'net').amount).toBe(44e6);
  });
  it('the comparative is the same period of the year before', () => {
    expect(line(pl, 'rev-total').compare).toBe(50e6);
    expect(line(pl, 'net').compare).toBe(40e6);
  });
});

describe('balance sheet', () => {
  const bs = balanceSheet(input);
  it('balances and shows the profit of the year apart from the retained earnings', () => {
    expect(line(bs, 'assets-total').amount).toBe(line(bs, 'le-total').amount);
    expect(bs.checks.every((c) => c.ok)).toBe(true);
    expect(line(bs, 'ca-cash').amount).toBe(100e6 + 50e6 + 30e6 + 1e6 - 24e6 - 10e6 - 15e6 - 12e6 - 6e6 - 5e6);
    expect(line(bs, 'fa-net').amount).toBe(30e6 - 2e6);
    expect(line(bs, 'eq-year').amount).toBe(44e6 - 3e6 + 3e6 - 0); // salaries of Sept are inside the profit
    expect(line(bs, 'eq-cap').amount).toBe(100e6);
  });
  it('the comparative column is the end of the year before', () => {
    expect(line(bs, 'assets-total').compare).toBe(line(bs, 'le-total').compare);
    expect(line(bs, 'ca-cash').compare).toBe(100e6 - 24e6 - 10e6);
    expect(line(bs, 'eq-year').compare).toBe(40e6); // the profit of 2025 is the profit of that year
    expect(line(bs, 'eq-ret').amount).toBe(40e6 - 5e6); // brought forward into 2026, less the dividend booked on the retained earnings account
  });
});

describe('cash flow', () => {
  const cf = cashFlow(input);
  it('is tied to the cash on the balance sheet', () => {
    expect(cf.checks.every((c) => c.ok)).toBe(true);
    const bs = balanceSheet(input);
    expect(line(cf, 'close').amount).toBe(line(bs, 'ca-cash').amount);
  });
  it('splits operating, investing and financing', () => {
    expect(line(cf, 'op-dep').amount).toBe(2e6);
    expect(line(cf, 'op-rec').amount).toBe(0); // receivable 50 mio before and after: the 2025 sale was collected, the 2026 sale is open
    expect(line(cf, 'inv-fa').amount).toBe(-6e6);
    expect(line(cf, 'fin-div').amount).toBe(-5e6);
  });
});
