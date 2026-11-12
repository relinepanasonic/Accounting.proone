import { describe, it, expect } from 'vitest';
import { normalizeStoreProducts, productsKey } from './top-products';
import { storeKeyOf } from './performance';

describe('normalizeStoreProducts', () => {
  it('sorts best first, cleans names, drops empty and zero-sales products, and keeps at most 10', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ name: `Produk ${i}`, sales: 1000 * (i + 1) }));
    const s = normalizeStoreProducts('dashboard', { store: 'onat.hardware', products: [{ name: '  Roda   Caster  ', sales: '5000' }, { name: '', sales: 9000 }, { name: 'Gratis', sales: 0 }, { name: 'Negatif', sales: -5 }, ...many] })!;
    expect(s.products).toHaveLength(10);
    expect(s.products[0]).toEqual({ name: 'Produk 13', sales: 14000 });
    expect(s.products.some((p) => p.name === 'Gratis' || p.name === 'Negatif' || p.name === '')).toBe(false);
    expect(s.products.find((p) => p.name === 'Roda Caster')?.sales).toBe(5000);
  });
  it('accepts a dealer as the store (Reline) and needs a name', () => {
    expect(normalizeStoreProducts('reline', { dealer: 'Dealer X', workspace: 'Alpha', products: [] })).toMatchObject({ store: 'Dealer X', workspace: 'Alpha', products: [] });
    expect(normalizeStoreProducts('reline', { products: [] })).toBeNull();
  });
  it('its key is the same as the performance rows use, so a store finds its products', () => {
    const p = normalizeStoreProducts('reline', { store: 'Dealer X', workspace: 'Alpha', products: [] })!;
    expect(productsKey(p)).toBe(storeKeyOf({ source: 'reline', store: 'Dealer X', workspace: 'Alpha' }));
  });
});
