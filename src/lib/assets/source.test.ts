import { describe, it, expect } from 'vitest';
import { mainPaymentOf } from './source';

const tx = (id: string, amount: number, category: string, reconciled: boolean, ref: string | null = null) => ({ id, amount, category, reconciled, bank_reference: ref });

describe('main payment of an asset', () => {
  it('follows the linked payment; reconciled means a bank match', () => {
    const m = mainPaymentOf([{ id: 'a', initial_value: 100, source_transaction_id: 't2' }], [tx('t1', 100, '1201 - Office', true, 'BANK-REF:1'), tx('t2', 100, '1201 - Office', false)]);
    expect(m.get('a')).toEqual({ id: 't2', matched: false });
  });

  it('an older asset without a link is found by amount in an asset account, preferring the matched one', () => {
    const m = mainPaymentOf([{ id: 'a', initial_value: 500 }, { id: 'b', initial_value: 999 }], [tx('x', 500, '1201 - Office', false), tx('y', 500, '1201 - Office', true, 'BANK-REF:9'), tx('z', 999, '6000 - Other', true, 'BANK-REF:2')]);
    expect(m.get('a')).toEqual({ id: 'y', matched: true });
    expect(m.has('b')).toBe(false); // not an asset payment
  });
});
