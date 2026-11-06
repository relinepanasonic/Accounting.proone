import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({ default: (p: any) => React.createElement('a', { href: p.href }, p.children) }));
vi.mock('@/app/actions/invoices', () => ({ recordInvoicePayment: async () => ({ success: true }) }));

const base = {
  invoiceNumber: 'INV-2026-642', accountNumber: '#INV-2026-642', invoiceDate: '05 Nov 2026', issueDate: '06 Nov 2026',
  clientName: 'SARI SURABAYA', clientLegalName: 'CV SARI AGUNG', clientPhone: '', clientAddress: 'JL PANGGUNG, 23, SURABAYA',
  items: [{ name: 'Renewal Paket Sultan', description: 'Managed Akun Shopee 3 bulan', quantity: 3, unitPrice: 2522523, total: 7567569, scale: 'month' }],
  subtotal: 7567569, taxAmount: 832432, grandTotal: 8248648,
} as any;

describe('Billed To block of the invoice and quotation', () => {
  it('PIC - Brand on one line, company name smaller, then the address', async () => {
    const { InvoicePDFDocument } = await import('./InvoicePDFDocument');
    const html = renderToString(React.createElement(InvoicePDFDocument, { ...base, clientBrand: 'SARI SURABAYA', clientContact: 'Ibu Sari' }));
    expect(html).toContain('Ibu Sari - SARI SURABAYA');
    expect(html).toContain('CV SARI AGUNG - SARI SURABAYA');
    expect(html.indexOf('Ibu Sari - SARI SURABAYA')).toBeLessThan(html.indexOf('JL PANGGUNG'));
  });

  it('an address typed as the PIC is not printed as the headline, and the page cannot be widened by it', async () => {
    const { InvoicePDFDocument } = await import('./InvoicePDFDocument');
    const addr = 'JL DEWI SARTIKA NO. 14 RT. 003 RW. 012, CAWANG, KRAMATJATI, KOTA ADM. JAKARTA TIMUR, DKI JAKARTA';
    const html = renderToString(React.createElement(InvoicePDFDocument, { ...base, documentType: 'QUOTATION', clientName: 'PT PANASONIC GOBEL INDONESIA', clientLegalName: '', clientBrand: 'PANASONIC', clientContact: addr, clientAddress: addr }));
    expect(html).not.toContain(`${addr} - PANASONIC`);
    expect(html).toContain('>PANASONIC<');
    expect(html).toContain('max-w-[340px]');
  });

  it('with no PIC and no brand the company name is the headline', async () => {
    const { InvoicePDFDocument } = await import('./InvoicePDFDocument');
    const html = renderToString(React.createElement(InvoicePDFDocument, { ...base, clientLegalName: '', clientBrand: '', clientContact: 'SARI SURABAYA' }));
    expect(html).toContain('>SARI SURABAYA<');
  });
});
