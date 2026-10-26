// MRR: the monthly recurring revenue. A product with a length in months (Paket Optimize Shopee, Meta Ads, Renewal Paket...) is a subscription:
// what the client pays (without VAT) is spread over the months of the service, and each month carries its share. Pure module.

export interface MrrProduct { name: string; duration_type: string | null; duration_value: number | null }
export interface MrrLine { package_name?: string | null; description?: string | null; quantity?: number | string | null; unit_price?: number | string | null; discount_amount?: number | string | null }
export interface MrrInvoice { issue_date?: string | null; status?: string | null; is_quotation?: boolean | null; notes?: string | null; invoice_line_items?: MrrLine[] | MrrLine | null }

const NOT_ISSUED = new Set(['draft', 'cancelled', 'canceled', 'void']);
const key = (s: string | null | undefined) => String(s || '').trim().toLowerCase();

/** The month the service starts: the project date of the invoice when it has one, else the invoice date. */
export function serviceStart(inv: Pick<MrrInvoice, 'issue_date' | 'notes'>): string | null {
  const tag = /\[ProjectDate:(\d{4}-\d{2}-\d{2})\]/.exec(String(inv.notes || ''))?.[1];
  return tag || (inv.issue_date ? String(inv.issue_date).slice(0, 10) : null);
}

/** MRR of the 12 months of `year` (index 0 = January). */
export function mrrByMonth(invoices: MrrInvoice[], products: MrrProduct[], year: number): number[] {
  const out = new Array(12).fill(0);
  const monthly = new Map<string, number>(); // product name -> months of one unit
  for (const p of products) if (p.duration_type === 'month' && Number(p.duration_value) >= 1) monthly.set(key(p.name), Number(p.duration_value));
  if (!monthly.size) return out;
  for (const inv of invoices) {
    if (inv.is_quotation || NOT_ISSUED.has(key(inv.status))) continue;
    const start = serviceStart(inv);
    if (!start) continue;
    const startIndex = Number(start.slice(0, 4)) * 12 + (Number(start.slice(5, 7)) - 1);
    const lines = Array.isArray(inv.invoice_line_items) ? inv.invoice_line_items : inv.invoice_line_items ? [inv.invoice_line_items] : [];
    for (const l of lines) {
      const perUnit = monthly.get(key(l.package_name)) ?? monthly.get(key(l.description));
      if (!perUnit) continue;
      const qty = Math.max(1, Math.round(Number(l.quantity) || 1));
      const net = Math.max(0, qty * (Number(l.unit_price) || 0) - (Number(l.discount_amount) || 0));
      const months = perUnit * qty;
      const share = net / months;
      for (let k = 0; k < months; k++) {
        const idx = startIndex + k - year * 12;
        if (idx >= 0 && idx < 12) out[idx] += share;
      }
    }
  }
  return out.map((v) => Math.round(v));
}
