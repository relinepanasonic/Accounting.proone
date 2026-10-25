import { describe, it, expect } from 'vitest';
import { monthlyIdr, KNOWN_SUBSCRIPTIONS } from './known';

describe('subscription cost', () => {
  it('a yearly price is a twelfth, USD uses the rate, and an inactive one costs nothing', () => {
    expect(monthlyIdr({ amount: 500000, currency: 'IDR', cycle: 'monthly' }, 16500)).toBe(500000);
    expect(monthlyIdr({ amount: 120, currency: 'IDR', cycle: 'yearly' }, 16500)).toBe(10);
    expect(monthlyIdr({ amount: 25, currency: 'USD', cycle: 'monthly' }, 16000)).toBe(400000);
    expect(monthlyIdr({ amount: 25, currency: 'USD', cycle: 'monthly', active: false }, 16000)).toBe(0);
  });

  it('the usual list has no duplicate names', () => {
    const names = KNOWN_SUBSCRIPTIONS.map((k) => k.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
