import { describe, it, expect } from 'vitest';
import { paymentOf } from './payment-status';

const today = '2026-11-16';
describe('where an invoice stands', () => {
  it('no invoice gives no badge', () => { expect(paymentOf(null, today)).toBeNull(); });
  it('unpaid before the due date, overdue after it', () => {
    expect(paymentOf({ total_amount: 3000000, amount_paid: 0, due_date: '2026-11-20' }, today)).toBe('unpaid');
    expect(paymentOf({ total_amount: 3000000, amount_paid: 0, due_date: '2026-11-10' }, today)).toBe('overdue');
    expect(paymentOf({ total_amount: 3000000, amount_paid: 0, due_date: '2026-11-16' }, today)).toBe('unpaid');     // due today is not late yet
  });
  it('part paid, and part paid but late is overdue', () => {
    expect(paymentOf({ total_amount: 3000000, amount_paid: 1000000, due_date: '2026-11-30' }, today)).toBe('partial');
    expect(paymentOf({ total_amount: 3000000, amount_paid: 1000000, due_date: '2026-11-01' }, today)).toBe('overdue');
  });
  it('paid in full (or marked paid), whatever the due date', () => {
    expect(paymentOf({ total_amount: '3000000', amount_paid: '3000000', due_date: '2026-11-01' }, today)).toBe('paid');
    expect(paymentOf({ status: 'PAID', total_amount: 3000000, amount_paid: 0 }, today)).toBe('paid');
  });
});
