import { describe, it, expect } from 'vitest';
import { dppOf, nwInvoiceNumber, billingDescription, decideBilling } from './nw-billing';
import { NEW_WAVE_WORKSPACE_ID, PT_WORKSPACE_ID } from '@/lib/workspaces/known';

describe('New Wave billing to PT', () => {
  it('DPP is the invoice without VAT and without the PPh the client withholds', () => {
    expect(dppOf({ dpp_amount: 3749999.88, total_amount: 4087499.87, tax_amount: 412499.99, pph_amount: 75000 })).toBe(3749999.88);
    expect(dppOf({ dpp_amount: 0, total_amount: 1472972.97, tax_amount: 148648.65, pph_amount: 0 })).toBe(1324324.32);
    expect(dppOf({ dpp_amount: 0, total_amount: 1470000, tax_amount: 0, pph_amount: 0 })).toBe(1470000);
  });

  it('numbers and descriptions say which PT invoice and which client', () => {
    expect(nwInvoiceNumber('INV-2026-163')).toBe('NW-2026-163');
    expect(billingDescription(['NW Regular Live Only', 'NW Regular Live Only'], 'Lofree', 'INV-2026-163')).toBe('NW Regular Live Only - Lofree (INV-2026-163)');
  });

  const pt = (over: any = {}) => ({ workspace_id: PT_WORKSPACE_ID, assigned_workspace_id: NEW_WAVE_WORKSPACE_ID, is_quotation: false, status: 'sent', issue_date: '2026-02-06', ...over });
  const want = { amount: 1324324.32, dueDate: '2026-02-13', description: 'X - Lofree (INV-2026-163)' };
  const nw = (over: any = {}) => ({ total_amount: 1324324.32, amount_paid: 0, status: 'sent', issue_date: '2026-02-06', due_date: '2026-02-13', description: want.description, ...over });

  it('creates for a New Wave job from January 2026, once issued', () => {
    expect(decideBilling({ pt: pt(), nw: null, want })).toBe('create');
    expect(decideBilling({ pt: pt({ status: 'paid' }), nw: null, want })).toBe('create');
    expect(decideBilling({ pt: pt({ status: 'draft' }), nw: null, want })).toBe('skip');
    expect(decideBilling({ pt: pt({ issue_date: '2025-12-31' }), nw: null, want })).toBe('skip');
    expect(decideBilling({ pt: pt({ assigned_workspace_id: null }), nw: null, want })).toBe('skip');
    expect(decideBilling({ pt: pt({ is_quotation: true }), nw: null, want })).toBe('skip');
  });

  it('keeps, updates, blocks or removes an existing New Wave invoice', () => {
    expect(decideBilling({ pt: pt(), nw: nw(), want })).toBe('unchanged');
    expect(decideBilling({ pt: pt(), nw: nw({ total_amount: 1000000 }), want })).toBe('update');
    expect(decideBilling({ pt: pt(), nw: nw({ total_amount: 1000000, amount_paid: 500 }), want })).toBe('blocked');
    expect(decideBilling({ pt: pt({ status: 'cancelled' }), nw: nw(), want })).toBe('remove');
    expect(decideBilling({ pt: pt({ assigned_workspace_id: null }), nw: nw(), want })).toBe('remove');
  });
});
