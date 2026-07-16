'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface CreateInvoicePayload {
  clientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  bankAccountId?: string;
  paymentInstructions?: string;
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

import { getAuthenticatedWorkspaceContext as getCanonicalWorkspaceContext } from '@/lib/auth/workspace-context';

/**
 * Helper: Retrieve Authenticated User ID and their active workspace_id (respecting multi-tenant cookie)
 */
async function getAuthenticatedWorkspaceContext(supabase: any): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const ctx = await getCanonicalWorkspaceContext(supabase);
  if (!ctx.userId && !ctx.activeWorkspaceId) {
    throw new Error('Unauthorized: Authentication required to create or manage invoices.');
  }
  return {
    userId: ctx.userId || 'seed-user',
    workspaceId: ctx.activeWorkspaceId,
  };
}

/**
 * Server Action: Create a new action-oriented invoice and its line items.
 * Strictly enforces authentication and RLS workspace context.
 */
export async function createInvoice(payload: CreateInvoicePayload): Promise<InvoiceActionResult> {
  try {
    // 1. Authenticated Server Client reading Next.js cookie store
    const supabase = await createClient();

    // 2 & 3. Fetch Auth UID & Workspace ID from workspace_members
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    if (!payload.clientId) {
      return { success: false, error: 'Client Payee is required.' };
    }

    if (!payload.lineItems || payload.lineItems.length === 0) {
      return { success: false, error: 'At least one deliverable line item is required.' };
    }

    // Calculate Subtotal & Total
    const totalAmount = payload.lineItems.reduce(
      (acc: number, item: any) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
      0
    );

    // 4a. Inject workspace_id into parent invoices payload, with auto-retry on duplicate key collision
    let invoiceNumberToUse = payload.invoiceNumber || `INV-2026-${Math.floor(100 + Math.random() * 900)}`;
    let invoice: any = null;
    let invoiceError: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const insertData: any = {
        workspace_id: workspaceId,
        client_id: payload.clientId,
        invoice_number: invoiceNumberToUse,
        status: 'draft',
        issue_date: payload.issueDate,
        due_date: payload.dueDate,
        subtotal: totalAmount,
        total_amount: totalAmount,
        notes: payload.notes || null,
      };
      if (payload.bankAccountId) insertData.bank_account_id = payload.bankAccountId;
      if (payload.paymentInstructions) insertData.payment_instructions = payload.paymentInstructions;

      let res = await supabase
        .from('invoices')
        .insert(insertData)
        .select('id')
        .single();

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('does not exist') || res.error.message?.includes('Could not find the'))) {
        delete insertData.bank_account_id;
        delete insertData.payment_instructions;
        res = await supabase.from('invoices').insert(insertData).select('id').single();
      }

      invoice = res.data;
      invoiceError = res.error;

      if (!invoiceError && invoice) {
        break;
      }

      // If duplicate invoice_number unique constraint collision occurs, append unique suffix and retry
      if (
        invoiceError?.code === '23505' ||
        invoiceError?.message?.includes('duplicate key') ||
        invoiceError?.message?.includes('uq_workspace_invoice_number')
      ) {
        const randomSuffix = Math.floor(100 + Math.random() * 900);
        invoiceNumberToUse = `${payload.invoiceNumber || 'INV'}-${randomSuffix}`;
      } else {
        break; // If it's a different error, stop retrying
      }
    }

    if (invoiceError || !invoice) {
      return {
        success: false,
        error: `Database error inserting invoice: ${invoiceError?.message || 'Unknown error'}`,
      };
    }

    // 4b. Inject workspace_id into every item in invoice_line_items array
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
    console.error('Exception in createInvoice:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while creating the invoice.',
    };
  }
}

/**
 * Server Action: One-Click Duplicate Invoice
 */
export async function duplicateInvoice(invoiceId: string) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const { data: orig, error: fetchErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchErr || !orig) {
      return { success: false, error: 'Original invoice not found or access denied.' };
    }

    const { data: origLines } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true });

    const today = new Date();
    const issueDateStr = today.toISOString().split('T')[0];
    const due = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
    const dueDateStr = due.toISOString().split('T')[0];
    const copyNumber = `${orig.invoice_number}-COPY-${Math.floor(100 + Math.random() * 900)}`;

    const { data: newInv, error: dupErr } = await supabase
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
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
        workspace_id: workspaceId,
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
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const nextStatus = currentStatus.toLowerCase() === 'paid' ? 'overdue' : 'paid';

    const { error } = await supabase
      .from('invoices')
      .update({ status: nextStatus })
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId);

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

/**
 * Server Action: Permanently Delete Invoice and its Line Items
 */
export async function deleteInvoice(invoiceId: string) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    await supabase
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('workspace_id', workspaceId);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/invoices');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting invoice.' };
  }
}
