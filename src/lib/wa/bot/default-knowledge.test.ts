import { describe, it, expect } from 'vitest';
import { DEFAULT_BOT_KNOWLEDGE as K } from './default-knowledge';

describe('the one package: Paket Optimizing', () => {
  it('lists what is in it and the 3-month contract', () => {
    for (const t of ['PAKET OPTIMIZING', 'Optimasi iklan toko', '30 foto hasil edit AI (untuk 10 SKU)', '10 video hasil edit AI (untuk 10 SKU)', 'Upload 10 SKU ke etalase', 'Kontrak minimal 3 bulan']) expect(K).toContain(t);
  });
  it('has no price and no other package to sell', () => {
    expect(K).not.toMatch(/Rp\s?\d/);
    expect(K).toContain('JANGAN menyebut angka harga');
    expect(K).not.toMatch(/^- (New Store|Lapak|Juragan|Sultan|Big Company|Trial)/m);
  });
});
