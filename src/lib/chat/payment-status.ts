/**
 * Where an invoice stands with the client, for the badge on a deal: Unpaid, Partly paid, Paid, or Overdue (unpaid or part paid after the due date).
 * Pure, so it is tested. Read from the invoice itself (total, amount paid, due date), never typed by hand.
 */
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export interface InvoiceMoney { status?: string | null; total_amount?: number | string | null; amount_paid?: number | string | null; due_date?: string | null }

export function paymentOf(inv: InvoiceMoney | null | undefined, today: string): PaymentStatus | null {
  if (!inv) return null;
  const total = Number(inv.total_amount || 0);
  const paid = Number(inv.amount_paid || 0);
  if (String(inv.status || '').toLowerCase() === 'paid' || (total > 0 && paid >= total - 0.5)) return 'paid';
  const due = String(inv.due_date || '').slice(0, 10);
  if (due && due < today) return 'overdue';
  return paid > 0 ? 'partial' : 'unpaid';
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = { unpaid: 'Unpaid', partial: 'Partly paid', paid: 'Paid', overdue: 'Overdue' };
