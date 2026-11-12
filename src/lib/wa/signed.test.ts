import { describe, it, expect, beforeEach } from 'vitest';
import { signedWeeklyPdfUrl, validWeeklyPdfSignature } from './signed';

const NOW = Date.UTC(2026, 10, 16, 1, 0, 0);
const parts = (url: string) => { const u = new URL(url); return { id: decodeURIComponent(u.pathname.split('/').pop()!), exp: u.searchParams.get('exp'), sig: u.searchParams.get('sig') }; };

describe('signed weekly PDF links', () => {
  beforeEach(() => { process.env.ERP_API_KEY = 'test-key-for-signing'; });

  it('a fresh link is valid for its own draft only', () => {
    const p = parts(signedWeeklyPdfUrl('abc-123', 3600, 'https://erp.test', NOW));
    expect(validWeeklyPdfSignature(p.id, p.exp, p.sig, NOW)).toBe(true);
    expect(validWeeklyPdfSignature('other-id', p.exp, p.sig, NOW)).toBe(false);
  });
  it('expires', () => {
    const p = parts(signedWeeklyPdfUrl('abc-123', 3600, 'https://erp.test', NOW));
    expect(validWeeklyPdfSignature(p.id, p.exp, p.sig, NOW + 3601 * 1000)).toBe(false);
  });
  it('rejects a tampered expiry or signature, and missing parts', () => {
    const p = parts(signedWeeklyPdfUrl('abc-123', 3600, 'https://erp.test', NOW));
    expect(validWeeklyPdfSignature(p.id, String(Number(p.exp) + 86400), p.sig, NOW)).toBe(false);
    expect(validWeeklyPdfSignature(p.id, p.exp, `${p.sig}0`, NOW)).toBe(false);
    expect(validWeeklyPdfSignature(p.id, null, p.sig, NOW)).toBe(false);
    expect(validWeeklyPdfSignature(p.id, p.exp, null, NOW)).toBe(false);
  });
  it('refuses everything when the server key is not set', () => {
    const p = parts(signedWeeklyPdfUrl('abc-123', 3600, 'https://erp.test', NOW));
    delete process.env.ERP_API_KEY;
    expect(validWeeklyPdfSignature(p.id, p.exp, p.sig, NOW)).toBe(false);
  });
});
