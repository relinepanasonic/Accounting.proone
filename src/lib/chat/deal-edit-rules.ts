import { LOCKED_STAGES } from '@/lib/sales/flow';
import { FINANCE_ROLES } from './crm-link';
import { normalizePhone } from './sales-team';

/** The short code of a lead (the first 6 characters of its id): shown on the card and in Fefe's answers, so "Hi Fefe #A1B2C3 ..." edits exactly that lead. */
export const dealCode = (id: string) => String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();

/** Who may edit or delete a lead: the finance roles and the BOD, and a salesperson for their own (or an unowned) lead. */
export function mayEditDeal(role: string, userId: string, deal: { salesman_id: string | null }): { ok: true } | { ok: false; error: string } {
  if (FINANCE_ROLES.includes(role)) return { ok: true };
  if (role === 'sales' && (!deal.salesman_id || deal.salesman_id === userId)) return { ok: true };
  return { ok: false, error: 'This lead belongs to another salesperson.' };
}

/** A lead that reached Accounting (invoice requested, invoiced, paid) is never deleted; move it to Lost instead. */
export function deleteBlock(deal: { stage: string; invoice_id?: string | null; paid_at?: string | null }, requests: number, projects: number): string | null {
  if (LOCKED_STAGES.includes(deal.stage) || deal.invoice_id || deal.paid_at || requests > 0) return 'This lead has an invoice or an invoice request, so it cannot be deleted. Move it to Lost instead.';
  if (projects > 0) return 'This lead has a project, so it cannot be deleted. Move it to Lost instead.';
  return null;
}

export interface DealEdit { name: string; store: string | null; pic: string | null; phone: string | null; address: string | null; notes: string | null; value: number; title: string }

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** The edit form, checked. */
export function cleanDealEdit(i: any): { ok: true; value: DealEdit } | { ok: false; error: string } {
  const name = text(i?.name, 120);
  if (!name) return { ok: false, error: 'Give the lead a name (the brand, the store or the person).' };
  const rawPhone = text(i?.phone, 40);
  const phone = rawPhone ? normalizePhone(rawPhone) : '';
  if (rawPhone && !phone) return { ok: false, error: 'The phone number looks wrong. Write it like 0812 3456 7890.' };
  const value = i?.value === '' || i?.value == null ? 0 : Number(i.value);
  if (!Number.isFinite(value) || value < 0 || value > 1e12) return { ok: false, error: 'The value must be a number, 0 or more.' };
  const notes = String(i?.notes ?? '').replace(/\r\n/g, '\n').trim().slice(0, 2000);
  return { ok: true, value: { name, store: text(i?.store, 120) || null, pic: text(i?.pic, 120) || null, phone: phone || null, address: text(i?.address, 300) || null, notes: notes || null, value: Math.round(value), title: text(i?.title, 120) || 'Lead' } };
}
