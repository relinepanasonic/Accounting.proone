import { describe, it, expect } from 'vitest';
import { mrrByMonth, serviceStart } from './mrr';

const products = [{ name: 'Paket Optimize Shopee Sultan', duration_type: 'month', duration_value: 1 }, { name: 'Paket 3 Bulan', duration_type: 'month', duration_value: 3 }, { name: 'NW Silver Live Only', duration_type: 'none', duration_value: 0 }];
const inv = (over: any) => ({ issue_date: '2026-03-10', status: 'paid', is_quotation: false, notes: null, ...over });
const line = (package_name: string, unit_price: number, quantity = 1, discount_amount = 0) => ({ package_name, unit_price, quantity, discount_amount });

describe('MRR', () => {
  it('a monthly product counts in its month; hour packages are not recurring', () => {
    const r = mrrByMonth([inv({ invoice_line_items: [line('Paket Optimize Shopee Sultan', 1000000), line('NW Silver Live Only', 9000000)] })], products, 2026);
    expect(r[2]).toBe(1000000);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1000000);
  });
  it('a 3-month product is spread over 3 months; the project date decides where it starts', () => {
    const r = mrrByMonth([inv({ notes: '[ProjectDate:2026-11-01]', invoice_line_items: [line('Paket 3 Bulan', 3000000)] })], products, 2026);
    expect(r.slice(10)).toEqual([1000000, 1000000]); // Nov, Dec of 2026; January 2027 is the next year
    expect(mrrByMonth([inv({ notes: '[ProjectDate:2026-11-01]', invoice_line_items: [line('Paket 3 Bulan', 3000000)] })], products, 2027)[0]).toBe(1000000);
  });
  it('quantity multiplies the months, a discount lowers the monthly share, drafts and quotes are left out', () => {
    const r = mrrByMonth([inv({ invoice_line_items: [line('Paket Optimize Shopee Sultan', 1000000, 2, 200000)] })], products, 2026);
    expect(r[2]).toBe(900000); expect(r[3]).toBe(900000); expect(r[4]).toBe(0);
    expect(mrrByMonth([inv({ status: 'draft', invoice_line_items: [line('Paket Optimize Shopee Sultan', 1000000)] }), inv({ is_quotation: true, invoice_line_items: [line('Paket Optimize Shopee Sultan', 1000000)] })], products, 2026).every((v) => v === 0)).toBe(true);
  });
  it('reads the project date tag', () => {
    expect(serviceStart({ issue_date: '2026-01-05', notes: '[ProjectDate:2026-02-01]\nx' })).toBe('2026-02-01');
    expect(serviceStart({ issue_date: '2026-01-05', notes: null })).toBe('2026-01-05');
  });
});
