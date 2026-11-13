import { describe, it, expect } from 'vitest';
import { ASK_SYSTEM, buildKnowledge, checkUpload, daysSince, DECK_SYSTEM, isStale, MAX_DECK_BYTES, storagePath, type BibleDocText } from './bible-text';

const doc = (over: Partial<BibleDocText> = {}): BibleDocText => ({ title: 'Sales Deck Nov', text: 'Paket Sultan: Rp 4.000.000 per bulan', text_updated_at: '2026-11-10T03:00:00Z', active: true, status: 'ready', ...over });

describe('checkUpload', () => {
  it('accepts a PDF of a sane size and says why it refuses anything else', () => {
    expect(checkUpload('Sales Deck.pdf', 2_000_000)).toBeNull();
    expect(checkUpload('deck.PDF', 10)).toBeNull();
    expect(checkUpload('deck.pptx', 1000)).toMatch(/PDF/);
    expect(checkUpload('deck.pdf', 0)).toMatch(/empty/);
    expect(checkUpload('deck.pdf', MAX_DECK_BYTES + 1)).toMatch(/too big/);
  });
});

describe('storagePath', () => {
  it('is inside the company folder, dated, and has a clean file name', () => {
    expect(storagePath('w1', 'Sales Deck (Nov) Ä.pdf', new Date('2026-11-13T05:00:00Z'), 'abc123')).toBe('w1/2026-11-13-abc123-Sales-Deck-Nov-A.pdf');
    expect(storagePath('w1', '../../etc/passwd.pdf', new Date('2026-11-13T05:00:00Z'), 'x')).not.toContain('..');
    expect(storagePath('w1', '', new Date('2026-11-13T05:00:00Z'), 'x')).toMatch(/\.pdf$/);
  });
});

describe('buildKnowledge', () => {
  it('puts the script first, then each active, ready document with the date its text was changed', () => {
    const k = buildKnowledge('TENTANG KAMI\nHalo', [doc()]);
    expect(k.startsWith('TENTANG KAMI')).toBe(true);
    expect(k).toContain('DOKUMEN: Sales Deck Nov (diperbarui 10 Nov 2026)');
    expect(k).toContain('Paket Sultan: Rp 4.000.000 per bulan');
    expect(k).toMatch(/dokumen dengan tanggal terbaru yang benar/);
  });
  it('leaves out inactive, unread or empty documents', () => {
    const k = buildKnowledge('script', [doc({ active: false, text: 'OLD PRICE' }), doc({ status: 'processing', text: 'HALF' }), doc({ text: '   ' })]);
    expect(k).toBe('script');
  });
  it('the newest document comes first', () => {
    const k = buildKnowledge('', [doc({ title: 'Old', text: 'A', text_updated_at: '2026-01-01T00:00:00Z' }), doc({ title: 'New', text: 'B', text_updated_at: '2026-11-01T00:00:00Z' })]);
    expect(k.indexOf('DOKUMEN: New')).toBeLessThan(k.indexOf('DOKUMEN: Old'));
  });
  it('cuts a very long document and the whole text, and says so', () => {
    const long = buildKnowledge('', [doc({ text: 'x'.repeat(20000) })]);
    expect(long).toContain('[teks dipotong]');
    expect(long.length).toBeLessThan(15000);
    const many = buildKnowledge('s'.repeat(30000), [doc({ text: 'y'.repeat(14000) }), doc({ title: 'B', text: 'z'.repeat(14000) })]);
    expect(many.length).toBeLessThanOrEqual(40000 + 20);
  });
});

describe('how old the prices are', () => {
  const now = new Date('2026-11-13T05:00:00Z');
  it('counts whole days and warns from 30 days', () => {
    expect(daysSince('2026-11-12T05:00:00Z', now)).toBe(1);
    expect(daysSince('2026-11-14T05:00:00Z', now)).toBe(0);
    expect(isStale('2026-10-20T05:00:00Z', now)).toBe(false);
    expect(isStale('2026-10-14T05:00:00Z', now)).toBe(true);
  });
});

describe('the instructions to the model', () => {
  it('the deck reader must copy numbers exactly and mark unreadable parts instead of guessing', () => {
    expect(DECK_SYSTEM).toMatch(/PERSIS/);
    expect(DECK_SYSTEM).toMatch(/TIDAK TERBACA/);
    expect(DECK_SYSTEM).toMatch(/tanpa Markdown/);
  });
  it('the question box answers only from the knowledge and admits when it is not there', () => {
    const s = ASK_SYSTEM('Paket Lapak: Rp 2.000.000');
    expect(s).toContain('Paket Lapak: Rp 2.000.000');
    expect(s).toMatch(/belum ada di AI Bible/);
  });
});
