import { describe, it, expect } from 'vitest';
import { storeLines } from './ClientStoreTable';

const row = (over: any) => ({ key: over.key, invoiceId: over.invoiceId ?? 'i', clientId: over.clientId ?? 'c1', clientName: 'Client', invoiceNumber: over.invoiceId, product: 'P', quantity: 1, start: null, paidAt: null, groupSize: 1, groupIndex: 0, stores: [], ...over }) as any;

describe('one line for each client', () => {
  it('a renewed package leaves only the latest project', () => {
    const lines = storeLines([
      row({ key: 'a', invoiceId: 'inv-1', start: '2026-01-01', stores: [{ id: 's1', company: 'ProOne', store: 'Toko A' }] }),
      row({ key: 'b', invoiceId: 'inv-2', start: '2026-07-01', stores: [{ id: 's1', company: 'ProOne', store: 'Toko A' }] }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].group[0].invoiceId).toBe('inv-2');
  });
  it('all the stores of a client stay in its one line', () => {
    const lines = storeLines([
      row({ key: 'a', invoiceId: 'inv-1', start: '2026-01-01', stores: [{ id: 's1', company: 'ProOne', store: 'A' }, { id: 's2', company: 'Reline', store: 'B' }] }),
      row({ key: 'z', invoiceId: 'inv-9', clientId: 'c2', start: '2026-02-01', stores: [] }),
    ]);
    expect(lines.map((l) => l.stores.length)).toEqual([2, 0]);
  });
  it('a client without an invoice yet yields to a real project', () => {
    const lines = storeLines([
      row({ key: 'n', invoiceId: '', start: null }),
      row({ key: 'r', invoiceId: 'inv-3', start: '2026-03-01' }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].group[0].invoiceId).toBe('inv-3');
  });
});
