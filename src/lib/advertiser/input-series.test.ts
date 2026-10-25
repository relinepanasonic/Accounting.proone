import { describe, it, expect } from 'vitest';
import { inputByDay, inputSeries, money, decimal } from './input-series';

const ad = (modalHarian: string, biayaIklan: string, penjualan: string, targetRoas = '') => ({ modalHarian, biayaIklan, penjualan, targetRoas });

describe('Input Log per day', () => {
  it('reads Rupiah and ROAS text', () => {
    expect(money('Rp 1,597,487')).toBe(1597487);
    expect(money('')).toBe(0);
    expect(decimal('11.5')).toBe(11.5);
    expect(decimal('11,5')).toBe(11.5);
    expect(decimal('Auto')).toBe(0);
  });

  it('session 1 is yesterday\'s spend and sales; the last session is today\'s budget and target', () => {
    const days = inputByDay([
      { client_id: 'c', report_date: '2026-10-02', session: 1, data_inkubasi: [ad('Rp 50,000', 'Rp 18,000', 'Rp 90,000')], data_group: [ad('Rp 100,000', 'Rp 40,000', 'Rp 600,000', '16')] },
      { client_id: 'c', report_date: '2026-10-02', session: 3, data_group: [ad('Rp 120,000', 'Rp 9,000', 'Rp 50,000', '16'), ad('Rp 80,000', '', '', '11')] },
      { client_id: 'c', report_date: '2026-10-02', session: 2, data_group: [ad('Rp 999,000', 'Rp 1,000', 'Rp 1,000', '99')] },
    ]).get('c')!;
    const oct1 = days.get('2026-10-01')!;
    expect(oct1.biaya).toBe(58000);
    expect(oct1.penjualan).toBe(690000);
    expect(oct1.modal).toBe(0);
    const oct2 = days.get('2026-10-02')!;
    expect(oct2.modal).toBe(200000); // session 3 only
    expect(oct2.biaya).toBe(0);
    expect(oct2.targetW / oct2.targetWeight).toBeCloseTo((16 * 120000 + 11 * 80000) / 200000);
  });

  it('budget used counts only the spend of days that have a budget', () => {
    const days = inputByDay([
      { client_id: 'c', report_date: '2026-10-02', session: 1, data_group: [ad('', 'Rp 50,000', 'Rp 500,000')] }, // spend of 1 Oct
      { client_id: 'c', report_date: '2026-10-01', session: 2, data_group: [ad('Rp 100,000', '', '', '10')] }, // budget of 1 Oct
      { client_id: 'c', report_date: '2026-10-03', session: 1, data_group: [ad('', 'Rp 30,000', 'Rp 90,000')] }, // spend of 2 Oct, no budget known
    ]);
    const s = inputSeries([days.get('c')!], 1, () => 0);
    expect(s.modal[0]).toBe(100000);
    expect(s.biaya[0]).toBe(80000);
    expect(s.biayaBudgeted[0]).toBe(50000);
    expect(s.target[0]).toBe(10);
  });
});
