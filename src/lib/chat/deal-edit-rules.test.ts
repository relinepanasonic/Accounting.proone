import { describe, it, expect } from 'vitest';
import { cleanDealEdit, dealCode, deleteBlock, mayEditDeal } from './deal-edit-rules';

describe('the edit form', () => {
  it('checks the name, the phone and the value', () => {
    expect(cleanDealEdit({ name: '  ' })).toMatchObject({ ok: false });
    expect(cleanDealEdit({ name: 'Bu Tati', phone: 'abc' })).toMatchObject({ ok: false });
    expect(cleanDealEdit({ name: 'Bu Tati', value: -5 })).toMatchObject({ ok: false });
    const r = cleanDealEdit({ name: 'Bu  Tati', store: 'Toko A', phone: '0812-3456-7890', value: '1500000', notes: ' x ' });
    expect(r).toMatchObject({ ok: true, value: { name: 'Bu Tati', store: 'Toko A', phone: '6281234567890', value: 1500000, notes: 'x', title: 'Lead' } });
  });
  it('empty optional fields clear', () => expect(cleanDealEdit({ name: 'A', store: '', phone: '' })).toMatchObject({ ok: true, value: { store: null, phone: null } }));
});

describe('who may edit or delete, and what is never deleted', () => {
  it('the finance roles and the BOD any lead; a salesperson their own or an unowned one', () => {
    expect(mayEditDeal('founder', 'u1', { salesman_id: 'u2' })).toEqual({ ok: true });
    expect(mayEditDeal('sales', 'u1', { salesman_id: 'u1' })).toEqual({ ok: true });
    expect(mayEditDeal('sales', 'u1', { salesman_id: null })).toEqual({ ok: true });
    expect(mayEditDeal('sales', 'u1', { salesman_id: 'u2' })).toMatchObject({ ok: false });
    expect(mayEditDeal('advertiser', 'u1', { salesman_id: null })).toMatchObject({ ok: false });
  });
  it('a lead with an invoice, a request or a project is never deleted', () => {
    expect(deleteBlock({ stage: 'Warm' }, 0, 0)).toBeNull();
    expect(deleteBlock({ stage: 'Invoice' }, 0, 0)).not.toBeNull();
    expect(deleteBlock({ stage: 'Warm', invoice_id: 'x' }, 0, 0)).not.toBeNull();
    expect(deleteBlock({ stage: 'Warm' }, 1, 0)).not.toBeNull();
    expect(deleteBlock({ stage: 'Warm' }, 0, 1)).not.toBeNull();
  });
  it('the code is the first 6 characters of the id', () => expect(dealCode('798a54d3-6418-48be-b3c7-9341d894657e')).toBe('798A54'));
});
