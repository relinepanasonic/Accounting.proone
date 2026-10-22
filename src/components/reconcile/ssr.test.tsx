import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({ default: (p: any) => React.createElement('a', { href: p.href }, p.children) }));
vi.mock('@/app/actions/invoices', () => ({ recordInvoicePayment: async () => ({ success: true }) }));
vi.mock('@/app/actions/reconcile', () => ({ reconcileRecord: async () => ({}), quickResolveAndReconcile: async () => ({}), unreconcileRecord: async () => ({ success: true }) }));
vi.mock('@/app/actions/settings', () => ({ createClientRecord: async () => ({}) }));
vi.mock('@/app/actions/bank-book', () => ({ saveBankStatement: async () => ({ success: true }), relinkBankBook: async () => ({ success: true }), releaseBankRef: async () => ({ success: true }) }));

describe('server render of the reconcile screens', () => {
  it('Unpaid Invoice table renders with data and without', async () => {
    const { UnpaidInvoiceTable } = await import('./UnpaidInvoiceTable');
    const rows = [{ id: 'a', number: 'INV-1', client: 'Acme', date: '2026-01-05', due: '2026-01-20', total: 1000000, paid: 0, balance: 1000000, status: 'sent' }, { id: 'b', number: 'INV-2', client: 'Beta', date: '', due: '', total: 5, paid: 0, balance: 5, status: 'sent' }];
    expect(renderToString(React.createElement(UnpaidInvoiceTable, { rows, banks: [{ id: 'x', name: 'Bank Jago | 1' }] }))).toContain('Acme');
    expect(renderToString(React.createElement(UnpaidInvoiceTable, { rows: [], banks: [] }))).toContain('Every invoice is paid');
  });
  it('Reconciliation screen renders with Buku Bank lines', async () => {
    const { ReconciliationHUD } = await import('./ReconciliationHUD');
    const html = renderToString(React.createElement(ReconciliationHUD, {
      systemRecords: [{ id: 't1', type: 'income', reference: 'Payment', payeeOrClient: 'Acme', date: '2026-01-05', amount: 1500000 }],
      bankAccounts: [{ id: 'b1', bank_name: 'Bank Jago', account_number: '123' }],
      openInvoices: [], bookLines: [{ id: 'l1', bankAccountId: 'b1', date: '2026-01-06', counterparty: 'X', details: '', notes: '', rekFrom: '', amount: -65000 }],
    } as any));
    expect(html).toContain('BANK');
  });
});
