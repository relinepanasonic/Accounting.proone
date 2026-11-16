import { describe, it, expect } from 'vitest';
import { accRequestText, ERP_LINK, invoiceRequestText } from './team-alerts-text';

describe('the ACC request to Herlan and Nico', () => {
  const t = accRequestText({ client: 'Toko Hijab Rina', title: 'Paket Juragan 3 bulan', value: 9000000, sales: 'Velly', lastNote: 'Client minta diskon 10% kalau bayar 3 bulan di muka.' });
  it('says who, what, how much, the sales and the last note, and links to the ERP pipeline', () => {
    expect(t).toContain('*Permintaan ACC Negosiasi*');
    expect(t).toContain('Client: Toko Hijab Rina');
    expect(t).toContain('Paket Juragan 3 bulan (Rp 9.000.000)');
    expect(t).toContain('Sales: Velly');
    expect(t).toContain('diskon 10%');
    expect(t.trim().endsWith(`${ERP_LINK}/sales/pipeline`)).toBe(true);
  });
  it('leaves out an empty note and a zero value, and never has two blank lines in a row', () => {
    const e = accRequestText({ client: 'A', title: 'Deal', value: 0, sales: '', lastNote: null });
    expect(e).not.toContain('Catatan negosiasi');
    expect(e).not.toContain('Rp');
    expect(e).not.toMatch(/\n\n\n/);
  });
});

describe('the invoice request to Lucy and Nico', () => {
  const items = [{ name: 'Paket Optimize Shopee', quantity: 3 }, { name: 'Friends Order', quantity: 1 }];
  it('lists the products, the total and the link to the ERP requests page', () => {
    const t = invoiceRequestText({ client: 'Sari Fashion', sales: 'Herlan', items, total: 11000000, note: 'Kirim hari ini ya' });
    expect(t).toContain('*Permintaan Buat Invoice*');
    expect(t).toContain('- Paket Optimize Shopee x3');
    expect(t).toContain('Total: Rp 11.000.000');
    expect(t).toContain('Catatan: Kirim hari ini ya');
    expect(t.trim().endsWith(`${ERP_LINK}/invoices/requests`)).toBe(true);
  });
  it('shows at most 5 products and says how many more', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `Produk ${i + 1}`, quantity: 1 }));
    const t = invoiceRequestText({ client: 'X', sales: 'Y', items: many, total: 1, note: null });
    expect(t).toContain('- Produk 5 x1');
    expect(t).not.toContain('Produk 6');
    expect(t).toContain('dan 3 produk lain');
  });
});
