import { describe, it, expect } from 'vitest';
import { advertiserOf, teamOf, nameKey, withoutWorkspace, type StoreAdvertiserMap } from './store-advertiser';

const team = (advertiserId: string | null, adminId: string | null = null, sales = '') => ({ advertiserId, adminId, sales, client: '' });
const map = (over: Partial<StoreAdvertiserMap> = {}): StoreAdvertiserMap => ({ advertisers: [], people: new Map(), byName: new Map(), manual: new Map(), manualReady: true, ...over });

describe('store to advertiser, admin and sales', () => {
  it('spelling, case and punctuation do not matter; the workspace can be cut off', () => {
    expect(nameKey('Toko Elektronik A.')).toBe(nameKey('toko  elektronik a'));
    expect(nameKey('')).toBe('');
    expect(withoutWorkspace('ProOne - Toko A')).toBe('tokoa');
    expect(withoutWorkspace('Lighting Solution - Dealer X')).toBe('dealerx');
    expect(withoutWorkspace('Toko A')).toBe('');
  });

  it('the client linked to the store gives the team; a hand assignment wins for the advertiser', () => {
    const m = map({
      byName: new Map([[nameKey('ProOne - Toko A'), team('ayu', 'vani', 'Nico')], [nameKey('Dealer X'), team('devi')]]),
      manual: new Map([['dashboard:Toko B', 'devi'], ['dashboard:Toko A', 'devi']]),
    });
    expect(teamOf(m, 'dashboard:Toko Q', 'ProOne - Toko A', 'Toko A')).toEqual(team('ayu', 'vani', 'Nico'));
    expect(advertiserOf(m, 'reline:Dealer X', 'Reline - Dealer X', 'Dealer X')).toBe('devi'); // the client has only the store name
    expect(advertiserOf(m, 'dashboard:Toko B', 'ProOne - Toko B', 'Toko B')).toBe('devi');
    expect(teamOf(m, 'dashboard:Toko A', 'ProOne - Toko A', 'Toko A').advertiserId).toBe('devi');
    expect(advertiserOf(m, 'dashboard:Toko Z', 'ProOne - Toko Z', 'Toko Z')).toBeNull();
  });
});
