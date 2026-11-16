import { describe, it, expect } from 'vitest';
import { skipSundayFor } from './report-utils';

describe('a Monday report is compared with Saturday, never Sunday', () => {
  it('on a Monday it names the Sunday to leave out', () => {
    expect(skipSundayFor('2026-11-16')).toBe('2026-11-15');       // Monday
    expect(skipSundayFor('2026-12-28')).toBe('2026-12-27');       // across a month end
  });
  it('every other day is compared as before', () => {
    for (const d of ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']) expect(skipSundayFor(d)).toBeNull();
  });
  it('no date or a bad date leaves everything as it is', () => {
    expect(skipSundayFor(null)).toBeNull();
    expect(skipSundayFor('16-11-2026')).toBeNull();
  });
});
