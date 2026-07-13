'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface CreateInvoicePayload {
  clientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * Server Action: Create a new action-oriented invoice and its line items.
 */
export async function createInvoice(payload: CreateInvoicePayload) {
  const supabase = await createClient();

  // Get active workspace ID (using first/default workspace or user workspace)
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1);

  const workspaceId = workspaces?.[0]?.id || '11111111-1111-1111-1111-111111111111';

  // Calculate Subtotal & Total
  const totalAmount = payload.lineItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0
  );

  // 1. Insert parent invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      workspace_id: workspaceId,
      client_id: payload.clientId,
      invoice_number: payload.invoiceNumber,
      status: 'draft',
      issue_date: payload.issueDate,
      due_date: payload.dueDate,
      subtotal: totalAmount,
      total_amount: totalAmount,
      notes: payload.notes || null,
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) {
    throw new Error(`Failed to create invoice: ${invoiceError?.message}`);
  }

  // 2. Bulk insert line items
  const lineItemsData = payload.lineItems.map((item, idx) => ({
    workspace_id: workspaceId,
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    sort_order: idx + 1,
  }));

  const { error: lineItemsError } = await supabase
    .from('invoice_line_items')
    .insert(lineItemsData);

  if (lineItemsError) {
    throw new Error(`Failed to insert line items: ${lineItemsError.message}`);
  }

  revalidatePath('/invoices');
  revalidatePath('/');
  return { success: true, invoiceId: invoice.id };
}

/**
 * Server Action: One-Click Duplicate Invoice (creates a fresh copy in 'draft' status with Net 15 terms).
 */
export async function duplicateInvoice(invoiceId: string) {
  const supabase = await createClient();

  // 1. Fetch original invoice
  const { data: orig, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (fetchErr || !orig) {
    throw new Error('Original invoice not found.');
  }

  // 2. Fetch original line items
  const { data: origLines } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  const today = new Date();
  const issueDateStr = today.toISOString().split('T')[0];
  const due = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  const dueDateStr = due.toISOString().split('T')[0];
  const copyNumber = `${orig.invoice_number}-COPY-${Math.floor(100 + Math.random() * 900)}`;

  // 3. Insert duplicate parent as draft
  const { data: newInv, error: dupErr } = await supabase
    .from('invoices')
    .insert({
      workspace_id: orig.workspace_id,
      client_id: orig.client_id,
      invoice_number: copyNumber,
      status: 'draft',
      issue_date: issueDateStr,
      due_date: dueDateStr,
      subtotal: orig.subtotal,
      total_amount: orig.total_amount,
      notes: orig.notes,
    })
    .select('id')
    .single();

  if (dupErr || !newInv) {
    throw new Error(`Duplicate failed: ${dupErr?.message}`);
  }

  // 4. Copy line items
  if (origLines && origLines.length > 0) {
    const linesToInsert = origLines.map((l) => ({
      workspace_id: l.workspace_id,
      invoice_id: newInv.id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      sort_order: l.sort_order,
    }));
    await supabase.from('invoice_line_items').insert(linesToInsert);
  }

  revalidatePath('/invoices');
  revalidatePath('/');
  return { success: true, newInvoiceId: newInv.id };
}

/**
 * Server Action: Toggle Invoice Status ('draft'/'overdue' <-> 'paid').
 */
export async function toggleInvoiceStatus(invoiceId: string, currentStatus: string) {
  const supabase = await createClient();
  const nextStatus = currentStatus.toLowerCase() === 'paid' ? 'overdue' : 'paid';

  const { error } = await supabase
    .from('invoices')
    .update({ status: nextStatus })
    .eq('id', invoiceId);

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  revalidatePath('/invoices');
  revalidatePath('/');
  return { success: true, newStatus: nextStatus };
}
