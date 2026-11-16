import { describe, it, expect } from 'vitest';
import { coldMessage, coldSlot, COLD_TOPICS } from './cold-education';
import { composeMessage, splitVariants } from './broadcast-rules';

describe('the cold-leads broadcast', () => {
  it('two sends a month: the 1st and the 15th (Jakarta)', () => {
    expect(coldSlot(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-A');
    expect(coldSlot(new Date('2026-11-14T10:00:00Z'))).toBe('2026-11-A');
    expect(coldSlot(new Date('2026-11-15T03:00:00Z'))).toBe('2026-11-B');
    expect(coldSlot(new Date('2026-11-30T03:00:00Z'))).toBe('2026-11-B');
    expect(coldSlot(new Date('2026-10-31T18:00:00Z'))).toBe('2026-11-A');      // 01:00 WIB on 1 Nov
  });
  it('the two messages of a month are different topics', () => {
    expect(coldMessage(new Date('2026-11-02T03:00:00Z'))).not.toBe(coldMessage(new Date('2026-11-16T03:00:00Z')));
  });
  it('every topic has two wordings, a way out, no price and no hard selling', () => {
    for (const t of COLD_TOPICS) {
      expect(splitVariants(t)).toHaveLength(2);
      expect(composeMessage(t, 0, 'Nico Japar')).toContain('Hi Nico');
      expect(composeMessage(t, 0, 'Nico Japar')).toContain('STOP');
      expect(t).not.toMatch(/Rp|diskon|promo|beli sekarang|terbatas/i);
    }
  });
});
