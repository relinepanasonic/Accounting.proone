import type { InvoicePdfData } from '@/lib/invoices/invoice-pdf';
import { workspaceCode } from '@/lib/workspaces/known';

/** The invoice as the PDF needs it, from the same database fields as the invoice page (service role: no login). Returns null when the invoice is not there. */
export async function loadInvoicePdfData(db: any, id: string): Promise<(InvoicePdfData & { fileName: string }) | null> {
  const { data: inv } = await db
    .from('invoices')
    .select('*, clients(*), invoice_line_items(*), workspaces!invoices_workspace_id_fkey(*), transactions(*)')
    .eq('id', id)
    .maybeSingle();
  if (!inv) return null;

  const client: any = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
  const ws: any = Array.isArray(inv.workspaces) ? inv.workspaces[0] : inv.workspaces;
  const lines: any[] = [...(inv.invoice_line_items || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const items = lines.map((l) => {
    const unitPrice = Number(l.unit_price || 0);
    const quantity = Number(l.quantity || 1);
    const discount = Number(l.discount_amount || 0);
    return { name: String(l.package_name || ''), description: String(l.description || ''), quantity, unitPrice, discount, total: unitPrice * quantity - discount };
  });
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = Number(inv.discount_amount || 0);

  const isTaxReg = ws?.is_tax_registered !== undefined && ws?.is_tax_registered !== null ? Boolean(ws.is_tax_registered) : Number(ws?.tax_rate_percent || 0) > 0;
  const taxRate = ws?.tax_rate_percent !== undefined && ws?.tax_rate_percent !== null ? Number(ws.tax_rate_percent) : isTaxReg ? 11 : 0;
  const taxable = Math.max(0, subtotal - discount);
  let taxAmount = isTaxReg ? Math.round(taxable * (taxRate / 100)) : 0;
  let grandTotal = taxable + taxAmount;
  if (inv.tax_calculation_type && inv.tax_calculation_type !== 'none') { taxAmount = Number(inv.tax_amount) || 0; grandTotal = Number(inv.total_amount) || 0; }
  else if (inv.total_amount) grandTotal = Number(inv.total_amount);

  // Bank accounts: the one chosen for this invoice, else all of the company.
  const { data: accounts } = await db.from('workspace_bank_accounts').select('*').eq('workspace_id', inv.workspace_id).order('is_default', { ascending: false });
  let banks: any[] = [];
  if (inv.bank_account_id && inv.bank_account_id !== 'all' && inv.bank_account_id !== 'custom') {
    banks = (accounts || []).filter((a: any) => a.id === inv.bank_account_id);
  } else if (inv.bank_account_id === 'custom' && inv.payment_instructions) {
    banks = [{ bank_name: 'Payment Instructions', account_number: inv.payment_instructions, account_name: ws?.name || '' }];
  }
  if (banks.length === 0) banks = accounts || [];

  const payments = (Array.isArray(inv.transactions) ? inv.transactions : [])
    .filter((t: any) => t.type === 'income')
    .sort((a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
    .map((t: any) => ({ date: String(t.transaction_date || t.due_date || ''), amount: Number(t.amount || 0) }));

  const number = String(inv.invoice_number || id);
  const clientName = String(client?.name || '');
  const safe = (s: string) => s.replace(/[\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const issue = String(inv.issue_date || inv.created_at || '').slice(0, 10);

  return {
    number,
    issueDate: issue,
    dueDate: String(inv.due_date || ''),
    status: String(inv.status || ''),
    company: {
      name: ws?.name || 'Company',
      tagline: ws?.brand_tagline || ws?.tagline || '',
      address: ws?.billing_address || ws?.address || '',
      phone: ws?.contact_phone || ws?.phone || '',
      email: ws?.official_email || ws?.email || '',
      website: ws?.website_url || ws?.website || '',
    },
    client: {
      name: clientName,
      legalName: client?.company_legal_name || '',
      contact: client?.contact_name || '',
      address: client?.billing_address || client?.address || '',
      phone: client?.phone || '',
      email: client?.email || '',
    },
    items,
    subtotal,
    discount,
    taxLabel: `PPN ${taxRate}%`,
    taxAmount,
    pphAmount: inv.has_pph ? Number(inv.pph_amount || 0) : 0,
    grandTotal,
    paid: Number(inv.amount_paid || 0),
    payments,
    banks: banks.map((b: any) => ({ bank: b.bank_name || '', number: b.account_number || '', holder: b.account_name || '' })),
    notes: String(inv.notes || '').replace(/\[ProjectDate:[^\]]+\]\n?/, ''),
    fileName: safe(`${issue} ${workspaceCode(inv.workspace_id, ws?.name)} ${number} ${clientName}`) + '.pdf',
  };
}
