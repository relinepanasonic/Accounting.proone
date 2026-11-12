import { describe, it, expect } from 'vitest';
import { signAsOli } from './oli';

describe('signAsOli', () => {
  it('greets the BOD as Oli, keeps the report whole, and signs off', () => {
    const out = signAsOli('daily', '*Daily Report*\n\n*Sales*');
    expect(out.startsWith('Halo BOD, saya Oli, admin Professor Online. Berikut laporan harian tim untuk kemarin:')).toBe(true);
    expect(out).toContain('*Daily Report*\n\n*Sales*');
    expect(out.endsWith('Salam,\nOli | Admin Professor Online')).toBe(true);
  });
  it('names the kind of report', () => {
    expect(signAsOli('weekly', 'x')).toContain('laporan mingguan tim');
    expect(signAsOli('monthly', 'x')).toContain('laporan bulanan tim');
    expect(signAsOli('other', 'x')).toContain('laporan tim');
  });
  it('signs nothing when there is nothing to send', () => {
    expect(signAsOli('daily', '  ')).toBe('');
  });
});
