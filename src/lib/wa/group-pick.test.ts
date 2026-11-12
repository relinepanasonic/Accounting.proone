import { describe, it, expect } from 'vitest';
import { clientGroupMap, pickGroup } from './group-pick';

describe('clientGroupMap', () => {
  it('keys a client by its name and company name, ignoring case and punctuation', () => {
    const m = clientGroupMap([{ name: 'Studio Blair', company_name: 'PT Blair Jaya.', wa_group_id: 'g1' }]);
    expect(m.get('studioblair')).toBe('g1');
    expect(m.get('ptblairjaya')).toBe('g1');
  });
  it('skips clients without a group, and does not guess when one name has two groups', () => {
    const m = clientGroupMap([
      { name: 'No Group', wa_group_id: null },
      { name: 'Toko A', wa_group_id: 'g1' },
      { name: 'toko a', wa_group_id: 'g2' },
      { name: 'Same', wa_group_id: 'g3' },
      { name: 'Same', wa_group_id: 'g3' },
    ]);
    expect(m.has('nogroup')).toBe(false);
    expect(m.get('tokoa')).toBeNull();
    expect(m.get('same')).toBe('g3');
  });
});

describe('pickGroup', () => {
  const byClient = new Map<string, string | null>([['studioblair', 'client-group'], ['tokoa', null]]);
  it('a store linked by hand wins over its client', () => {
    expect(pickGroup('ProOne - Studio Blair', 'Studio Blair', new Map([['ProOne - Studio Blair', 'store-group']]), byClient)).toBe('store-group');
  });
  it('otherwise the client group serves every store of that client', () => {
    expect(pickGroup('ProOne - Studio Blair', 'Studio Blair', new Map(), byClient)).toBe('client-group');
    expect(pickGroup('Reline - Blair Dealer', 'studio blair', new Map(), byClient)).toBe('client-group');
  });
  it('is null for an unknown client, an ambiguous name, or no client name', () => {
    expect(pickGroup('S', 'Unknown', new Map(), byClient)).toBeNull();
    expect(pickGroup('S', 'Toko A', new Map(), byClient)).toBeNull();
    expect(pickGroup('S', '', new Map(), byClient)).toBeNull();
  });
});
