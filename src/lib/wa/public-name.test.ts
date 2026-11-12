import { describe, it, expect } from 'vitest';
import { publicStoreName } from './public-name';

describe('publicStoreName', () => {
  it('drops the company in front of the store', () => {
    expect(publicStoreName('ProOne - onat.hardware')).toBe('onat.hardware');
    expect(publicStoreName('Reline - Arta Kusuma - Medan')).toBe('Arta Kusuma - Medan');
    expect(publicStoreName('Alpha - Dealer X')).toBe('Dealer X');
    expect(publicStoreName('Lighting Solution - Toko Lampu')).toBe('Toko Lampu');
    expect(publicStoreName('  proone \u2013 amiadoshop ')).toBe('amiadoshop');
  });
  it('leaves a store that has no company in front, and never returns an empty name', () => {
    expect(publicStoreName('onat.hardware')).toBe('onat.hardware');
    expect(publicStoreName('Proone Hardware Jaya')).toBe('Proone Hardware Jaya');
    expect(publicStoreName('ProOne - ')).toBe('ProOne -');
    expect(publicStoreName(null)).toBe('');
  });
  it('only the leading company goes, not a store whose name contains one', () => {
    expect(publicStoreName('ProOne - Reline Shop')).toBe('Reline Shop');
    expect(publicStoreName('Toko Alpha - Cabang 2')).toBe('Toko Alpha - Cabang 2');
  });
});
