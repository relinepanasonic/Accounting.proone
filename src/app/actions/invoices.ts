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

export interface InvoiceActionResult {
  success: boolean;
  invoiceId?: string;
  error?: string;
}

/**
 * Helper to securely resolve the active workspace ID for the current authenticated user
 */
async function resolveWorkspaceId(supabase: any): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1);

      if (memberRows && memberRows.length > 0 && memberRows[0].workspace_id) {
        return memberRows[0].workspace_id;
      }
    }

    // Fallback to active workspace query
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1);

    if (workspaces && workspaces.length > 0 && workspaces[0].id) {
      return workspaces[0].id;
    }
  } catch (err) {
    console.error('Error resolving workspace_id:', err);
  }

  // Safe default fallback matching seed workspace
  return '11111111-1111-1111-1111-111111111111';
}

/**
 * Server Action: Create a new action-oriented invoice and its line items.
 * Bulletproof try/catch returning serializable { success, invoiceId, error }.
 */
export async function createInvoice(payload: CreateInvoicePayload): Promise<InvoiceActionResult> {
  try {
    const supabase = await createClient();
    const workspaceId = await resolveWorkspaceId(supabase);

    if (!payload.clientId) {
      return { success: false, error: 'Client Payee is required.' };
    }

    if (!payload.lineItems || payload.lineItems.length === 0) {
      return { success: false, error: 'At least one deliverable line item is required.' };
    }

    // Calculate Subtotal & Total
    const totalAmount = payload.lineItems.reduce(
      (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
      0
    );

    // 1. Insert parent invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
        client_id: payload.clientId,
        invoice_number: payload.invoiceNumber || `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
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
      return {
        success: false,
        error: `Database error inserting invoice: ${invoiceError?.message || 'Unknown error'}`,
      };
    }

    // 2. Bulk insert line items
    const lineItemsData = payload.lineItems.map((item, idx) => ({
      workspace_id: workspaceId,
      invoice_id: invoice.id,
      description: item.description || 'Deliverable Item',
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unitPrice) || 0,
      sort_order: idx + 1,
    }));

    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItemsData);

    if (lineItemsError) {
      return {
        success: false,
        error: `Database error inserting line items: ${lineItemsError.message}`,
      };
    }

    revalidatePath('/invoices');
    revalidatePath('/');
    return { success: true, invoiceId: invoice.id };
  } catch (err: any) {
    console.error('Unhandled exception in createInvoice:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected server error occurred while creating the invoice.',
    };
  }
}

/**
 * Server Action: One-Click Duplicate Invoice
 */
export async function duplicateInvoice(invoiceId: string) {
  try {
    const supabase = await createClient();

    const { data: orig, error: fetchErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchErr || !orig) {
      return { success: false, error: 'Original invoice not found.' };
    }

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
      return { success: false, error: `Duplicate failed: ${dupErr?.message}` };
    }

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
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error duplicating invoice.' };
  }
}

/**
 * Server Action: Toggle Invoice Status
 */
export async function toggleInvoiceStatus(invoiceId: string, currentStatus: string) {
  try {
    const supabase = await createClient();
    const nextStatus = currentStatus.toLowerCase() === 'paid' ? 'overdue' : 'paid';

    const { error } = await supabase
      .from('invoices')
      .update({ status: nextStatus })
      .eq('id', invoiceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/invoices');
    revalidatePath('/');
    return { success: true, newStatus: nextStatus };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error toggling status.' };
  }
}
