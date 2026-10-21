import { describe, it, expect } from 'vitest';
import { matchLines, parseBankRef } from './link';

describe('bank book links', () => {
  it('reads a bank reference', () => {
    expect(parseBankRef('BANK-REF:2026-01-04:-234099:Hostinger XENDIT 9360 Pembayaran QRIS')).toEqual({ date: '2026-01-04', amount: -234099, text: 'Hostinger XENDIT 9360 Pembayaran QRIS' });
    expect(parseBankRef('BANK-MATCHED')).toBeNull();
  });
  it('links by day and amount, and uses the bank text when two records fit', () => {
    const lines = [
      { id: 'a', date: '2026-01-05', amount: -64000, counterparty: 'LOSKE COFFEE SERVICE SU' },
      { id: 'b', date: '2026-01-05', amount: -64000, counterparty: 'KOPI LAIN' },
      { id: 'c', date: '2026-01-06', amount: -1, counterparty: 'nobody' },
    ];
    const recs = [
      { kind: 'transaction' as const, id: 't1', bankReference: 'BANK-REF:2026-01-05:-64000:KOPI LAIN BCA 99 Pembayaran QRIS' },
      { kind: 'transaction' as const, id: 't2', bankReference: 'BANK-REF:2026-01-05:-64000:LOSKE COFFEE SERVICE SU BCA 936 Pembayaran QRIS' },
    ];
    const m = matchLines(lines, recs);
    expect(m.get('a')?.id).toBe('t2');
    expect(m.get('b')?.id).toBe('t1');
    expect(m.has('c')).toBe(false);
  });
  it('never links one record to two lines', () => {
    const lines = [{ id: 'a', date: '2026-01-05', amount: -10, counterparty: 'x' }, { id: 'b', date: '2026-01-05', amount: -10, counterparty: 'x' }];
    const m = matchLines(lines, [{ kind: 'invoice', id: 'i1', bankReference: 'BANK-REF:2026-01-05:-10:x' }]);
    expect(m.size).toBe(1);
  });
});
