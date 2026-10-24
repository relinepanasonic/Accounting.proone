import { describe, it, expect } from 'vitest';
import { advertiserOf, nameKey, type StoreAdvertiserMap } from './store-advertiser';

const map = (over: Partial<StoreAdvertiserMap> = {}): StoreAdvertiserMap => ({ advertisers: [], byName: new Map(), manual: new Map(), manualReady: true, ...over });

describe('store to advertiser', () => {
  it('spelling, case and punctuation do not matter', () => {
    expect(nameKey('Toko Elektronik A.')).toBe(nameKey('toko  elektronik a'));
    expect(nameKey('')).toBe('');
  });

  it('the client match gives the advertiser, and a hand assignment wins over it', () => {
    const m = map({ byName: new Map([[nameKey('Toko A'), 'ayu']]), manual: new Map([['dashboard:Toko B', 'devi'], ['dashboard:Toko A', 'devi']]) });
    expect(advertiserOf(m, 'dashboard:Toko C', 'toko a')).toBe('ayu');
    expect(advertiserOf(m, 'dashboard:Toko B', 'Toko B')).toBe('devi');
    expect(advertiserOf(m, 'dashboard:Toko A', 'Toko A')).toBe('devi');
    expect(advertiserOf(m, 'dashboard:Toko Z', 'Toko Z')).toBeNull();
  });
});
