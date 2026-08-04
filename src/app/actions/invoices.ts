'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface LineItem {
  packageName?: string;
  description: string;
  quantity: number;
  scale?: string;
  unitPrice: number;
  discountAmount?: number;
}

export interface CreateInvoicePayload {
  clientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  bankAccountId?: string;
  paymentInstructions?: string;
  isHistorical?: boolean;
  isQuotation?: boolean;
  discountAmount?: number;
  lineItems: LineItem[];
  assignedWorkspaceId?: string;
}

export interface UpdateInvoicePayload extends CreateInvoicePayload {
  id: string;
}

export interface InvoiceActionResult {
  success: boolean;
  invoiceId?: string;
  error?: string;
}

import { getAuthenticatedWorkspaceContext as getCanonicalWorkspaceContext } from '@/lib/auth/workspace-context';
import { getWorkspaceMappings } from './mappings';

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

async function syncInvoiceToNewWave(invoiceId: string, supabase: any): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.ACCOUNTING_API_KEY || process.env.NEWWAVE_INTEGRATION_TOKEN;
    if (!apiKey) return { success: false, error: 'API Key missing (ACCOUNTING_API_KEY or NEWWAVE_INTEGRATION_TOKEN)' };

    const { data: inv } = await supabase
      .from('invoices')
      .select('*, clients(*), invoice_line_items(*)')
      .eq('id', invoiceId)
      .single();

    if (!inv) return { success: false, error: 'Invoice not found in database for sync.' };
    
    const clientName = Array.isArray(inv.clients) ? inv.clients[0]?.name : inv.clients?.name;

    const rawLineItems = Array.isArray(inv.invoice_line_items) ? inv.invoice_line_items : (inv.invoice_line_items ? [inv.invoice_line_items] : []);

    const payload = {
      source: 'proone',
      external_id: inv.id,
      invoice_number: inv.invoice_number,
      brand: clientName || 'Unknown Client',
      invoice_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status,
      notes: inv.notes,
      items: rawLineItems.map((item: any) => {
        const discountedPrice = Number(item.unit_price) - ((Number(item.discount_amount) || 0) / Number(item.quantity));
        return {
          name: item.package_name || 'Service Item',
          description: item.description,
          is_free: false,
          scale: item.scale || 'pc',
          qty: Number(item.quantity) || 1,
          price: Math.max(0, discountedPrice)
        };
      })
    };

    const res = await fetch('https://app.newwave.id/api/accounting/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('New Wave sync returned non-ok status:', res.status, errText);
      return { success: false, error: `New Wave API error (${res.status}): ${errText}` };
    }
    
    return { success: true };
  } catch (err: any) {
    console.warn('Failed to sync invoice to New Wave:', err);
    return { success: false, error: err?.message || 'Network error pushing to New Wave' };
  }
}

export async function updateInvoice(payload: UpdateInvoicePayload): Promise<InvoiceActionResult> {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    if (!payload.id) {
      return { success: false, error: 'Invoice ID is required for updating.' };
    }
    if (!payload.clientId) {
      return { success: false, error: 'Client Payee is required.' };
    }
    if (!payload.lineItems || payload.lineItems.length === 0) {
      return { success: false, error: 'At least one deliverable line item is required.' };
    }

    const subtotal = payload.lineItems.reduce(
      (acc: number, item: any) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discountAmount) || 0),
      0
    );
    const globalDiscount = Number(payload.discountAmount) || 0;
    const totalAmount = Math.max(0, subtotal - globalDiscount);

    const updateData: any = {
      client_id: payload.clientId,
      invoice_number: payload.invoiceNumber,
      is_quotation: payload.isQuotation || false,
      issue_date: payload.issueDate,
      due_date: payload.dueDate,
      subtotal: subtotal,
      total_amount: totalAmount,
      discount_amount: globalDiscount,
      notes: payload.notes || null,
      bank_account_id: payload.bankAccountId || null,
      payment_instructions: payload.paymentInstructions || null,
      assigned_workspace_id: payload.assignedWorkspaceId || null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', payload.id)
      .eq('workspace_id', workspaceId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Delete existing line items
    const { error: deleteError } = await supabase
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', payload.id);

    if (deleteError) {
      console.warn('Failed to delete old line items:', deleteError);
    }

    // Insert new line items
    const lineItemsData = payload.lineItems.map((item, idx) => ({
      workspace_id: workspaceId,
      invoice_id: payload.id,
      package_name: item.packageName || null,
      description: item.description || 'Deliverable Item',
      quantity: Number(item.quantity) || 1,
      scale: item.scale || 'pc',
      unit_price: Number(item.unitPrice) || 0,
      discount_amount: Number(item.discountAmount) || 0,
      sort_order: idx + 1,
    }));

    const { error: linesError } = await supabase.from('invoice_line_items').insert(lineItemsData);
    if (linesError) {
      return { success: false, error: 'Invoice updated, but line items failed to save.' };
    }

    // New Double-Entry logic (replace old entries)
    if (!payload.isQuotation && totalAmount > 0) {
      const mappings = await getWorkspaceMappings(workspaceId);
      const salesAccount = mappings.find(m => m.mapping_type === 'SALES')?.account_code || '4001';
      const arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1002';

      await supabase.from('journal_entries').delete().eq('reference_id', payload.id).eq('reference_type', 'invoice');
      
      await supabase.from('journal_entries').insert([
        { workspace_id: workspaceId, account_code: arAccount, transaction_date: payload.issueDate, debit_amount: totalAmount, credit_amount: 0, description: `Invoice ${payload.invoiceNumber}`, reference_id: payload.id, reference_type: 'invoice' },
        { workspace_id: workspaceId, account_code: salesAccount, transaction_date: payload.issueDate, debit_amount: 0, credit_amount: totalAmount, description: `Invoice ${payload.invoiceNumber}`, reference_id: payload.id, reference_type: 'invoice' }
      ]);
    } else {
      await supabase.from('journal_entries').delete().eq('reference_id', payload.id).eq('reference_type', 'invoice');
    }

    const syncRes = await syncInvoiceToNewWave(payload.id, supabase);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${payload.id}`);
    
    if (syncRes && !syncRes.success) {
      return { success: true, invoiceId: payload.id, error: `Saved locally, but New Wave sync failed: ${syncRes.error}` };
    }
    return { success: true, invoiceId: payload.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'A fatal anomaly occurred while updating the invoice.' };
  }
}

export async function updateInvoiceAssignment(invoiceId: string, assignedWorkspaceId: string | null): Promise<InvoiceActionResult> {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const { error } = await supabase
      .from('invoices')
      .update({ assigned_workspace_id: assignedWorkspaceId })
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/invoices');
    return { success: true, invoiceId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update assignment.' };
  }
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
    const subtotal = payload.lineItems.reduce(
      (acc: number, item: any) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discountAmount) || 0),
      0
    );
    const globalDiscount = Number(payload.discountAmount) || 0;
    const totalAmount = Math.max(0, subtotal - globalDiscount);

    // 4a. Inject workspace_id into parent invoices payload, with auto-retry on duplicate key collision
    let invoiceNumberToUse = payload.invoiceNumber || `INV-2026-${Math.floor(100 + Math.random() * 900)}`;
    let invoice: any = null;
    let invoiceError: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const insertData: any = {
        workspace_id: workspaceId,
        client_id: payload.clientId,
        invoice_number: invoiceNumberToUse,
        is_quotation: payload.isQuotation || false,
        status: 'pending',
        issue_date: payload.issueDate,
        due_date: payload.dueDate,
        subtotal: subtotal,
        total_amount: totalAmount,
        discount_amount: globalDiscount,
        notes: payload.notes || null,
      };
      if (payload.assignedWorkspaceId) insertData.assigned_workspace_id = payload.assignedWorkspaceId;
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

    const lineItemsData = payload.lineItems.map((item, idx) => ({
      workspace_id: workspaceId,
      invoice_id: invoice.id,
      package_name: item.packageName || null,
      description: item.description || 'Deliverable Item',
      quantity: Number(item.quantity) || 1,
      scale: item.scale || 'pc',
      unit_price: Number(item.unitPrice) || 0,
      discount_amount: Number(item.discountAmount) || 0,
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

    // New Double-Entry logic
    if (!payload.isQuotation && totalAmount > 0) {
      const mappings = await getWorkspaceMappings(workspaceId);
      const salesAccount = mappings.find(m => m.mapping_type === 'SALES')?.account_code || '4001';
      const arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1002';

      await supabase.from('journal_entries').insert([
        { workspace_id: workspaceId, account_code: arAccount, transaction_date: payload.issueDate, debit_amount: totalAmount, credit_amount: 0, description: `Invoice ${invoiceNumberToUse}`, reference_id: invoice.id, reference_type: 'invoice' },
        { workspace_id: workspaceId, account_code: salesAccount, transaction_date: payload.issueDate, debit_amount: 0, credit_amount: totalAmount, description: `Invoice ${invoiceNumberToUse}`, reference_id: invoice.id, reference_type: 'invoice' }
      ]);
    }

    const syncRes = await syncInvoiceToNewWave(invoice.id, supabase);

    revalidatePath('/invoices');
    revalidatePath('/');
    
    if (syncRes && !syncRes.success) {
      return { success: true, invoiceId: invoice.id, error: `Saved locally, but New Wave sync failed: ${syncRes.error}` };
    }
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
    const copyNumber = `INV-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newInv, error: dupErr } = await supabase
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
        client_id: orig.client_id,
        invoice_number: copyNumber,
        status: 'pending',
        issue_date: issueDateStr,
        due_date: dueDateStr,
        subtotal: orig.subtotal,
        total_amount: orig.total_amount,
        notes: orig.notes,
        bank_account_id: orig.bank_account_id || null,
        payment_instructions: orig.payment_instructions || null,
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

    // Double-entry ledger integration: watch COA and affect COA Bank Account when paid
    if (nextStatus === 'paid') {
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
      if (inv) {
        let chosenBank: any = null;
        if (inv.bank_account_id && inv.bank_account_id !== 'all' && inv.bank_account_id !== 'custom') {
          const { data: bankRes } = await supabase.from('workspace_bank_accounts').select('*').eq('id', inv.bank_account_id).single();
          if (bankRes) chosenBank = bankRes;
        }
        if (!chosenBank) {
          const { data: firstBank } = await supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', workspaceId).order('is_default', { ascending: false }).limit(1);
          if (firstBank && firstBank.length > 0) chosenBank = firstBank[0];
        }
        const debitAccountCode = chosenBank?.coa_account_code || '1010';
        const todayStr = new Date().toISOString().split('T')[0];

        const mappings = await getWorkspaceMappings(workspaceId);
        const arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1002';

        // Clean up any prior payment JE for this invoice just in case
        await supabase.from('journal_entries').delete().eq('reference_id', invoiceId).eq('reference_type', 'payment');

        await supabase.from('journal_entries').insert([
          { workspace_id: workspaceId, account_code: debitAccountCode, transaction_date: todayStr, debit_amount: Number(inv.total_amount || 0), credit_amount: 0, description: `Payment for Invoice ${inv.invoice_number}`, reference_id: invoiceId, reference_type: 'payment' },
          { workspace_id: workspaceId, account_code: arAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: Number(inv.total_amount || 0), description: `Payment for Invoice ${inv.invoice_number}`, reference_id: invoiceId, reference_type: 'payment' }
        ]);
      }
    } else {
      await supabase.from('journal_entries').delete().eq('reference_id', invoiceId).eq('reference_type', 'payment');
    }

    await syncInvoiceToNewWave(invoiceId, supabase);

    revalidatePath('/invoices');
    revalidatePath('/ledger');
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

    // Delete associated ledger entries
    await supabase.from('journal_entries').delete().eq('reference_id', invoiceId);

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

/**
 * Server Action: Record Payment against an Invoice
 */
export async function recordInvoicePayment(invoiceId: string, amount: number, paymentDate: string, paymentMethod: string, reference?: string) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    // 1. Fetch current invoice state
    const { data: inv, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, amount_paid, total_amount, client_id, status, bank_account_id')
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchErr || !inv) throw new Error('Invoice not found.');

    const newAmountPaid = Number(inv.amount_paid) + amount;
    const isFullyPaid = newAmountPaid >= Number(inv.total_amount);
    
    // Determine new status (we keep it simple, if not fully paid it might remain 'sent' or 'draft', if fully paid it becomes 'paid')
    const newStatus = isFullyPaid ? 'paid' : (inv.status === 'draft' ? 'sent' : inv.status);

    // 2. Insert Transaction
    const { error: txErr } = await supabase.from('transactions').insert({
      workspace_id: workspaceId,
      type: 'income',
      category: 'Client Payment',
      amount: amount,
      transaction_date: paymentDate,
      description: `Payment for ${inv.invoice_number}${reference ? ' - ' + reference : ''}`,
      client_id: inv.client_id,
      invoice_id: inv.id,
      payment_method: paymentMethod
    });

    if (txErr) throw new Error('Failed to create payment transaction.');

    // 3. Ledger Double-Entry
    const mappings = await getWorkspaceMappings(workspaceId);
    const arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1002';
    
    let chosenBank: any = null;
    if (inv.bank_account_id && inv.bank_account_id !== 'all' && inv.bank_account_id !== 'custom') {
      const { data: bankRes } = await supabase.from('workspace_bank_accounts').select('*').eq('id', inv.bank_account_id).single();
      if (bankRes) chosenBank = bankRes;
    }
    if (!chosenBank) {
      const { data: firstBank } = await supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', workspaceId).order('is_default', { ascending: false }).limit(1);
      if (firstBank && firstBank.length > 0) chosenBank = firstBank[0];
    }
    const debitAccountCode = chosenBank?.coa_account_code || '1010';

    const todayStr = paymentDate || new Date().toISOString().split('T')[0];
    
    await supabase.from('journal_entries').insert([
      { workspace_id: workspaceId, account_code: debitAccountCode, transaction_date: todayStr, debit_amount: amount, credit_amount: 0, description: `Payment for Invoice ${inv.invoice_number}${reference ? ' - ' + reference : ''}`, reference_id: invoiceId, reference_type: 'payment' },
      { workspace_id: workspaceId, account_code: arAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: amount, description: `Payment for Invoice ${inv.invoice_number}${reference ? ' - ' + reference : ''}`, reference_id: invoiceId, reference_type: 'payment' }
    ]);

    // 4. Update Invoice
    const { error: invErr } = await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', invoiceId);

    if (invErr) throw new Error('Failed to update invoice balance.');

    await syncInvoiceToNewWave(invoiceId, supabase);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/ledger');
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error recording payment.' };
  }
}

export async function uploadTaxDocument(invoiceId: string, docType: 'faktur_pajak' | 'bukti_potong', base64Data: string) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const column = docType === 'faktur_pajak' ? 'faktur_pajak_url' : 'bukti_potong_url';
    const { error } = await supabase
      .from('invoices')
      .update({ [column]: base64Data })
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);

    revalidatePath('/invoices/tax');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error uploading document' };
  }
}

export async function deleteTaxDocument(invoiceId: string, docType: 'faktur_pajak' | 'bukti_potong') {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const column = docType === 'faktur_pajak' ? 'faktur_pajak_url' : 'bukti_potong_url';
    const { error } = await supabase
      .from('invoices')
      .update({ [column]: null })
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);

    revalidatePath('/invoices/tax');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting document' };
  }
}

export async function convertQuotationToInvoice(quotationId: string) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const invoiceNumber = `INV-2026-${Math.floor(100 + Math.random() * 900)}`;
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + 7);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const { error } = await supabase
      .from('invoices')
      .update({
        is_quotation: false,
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate,
        status: 'draft',
      })
      .eq('id', quotationId)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${quotationId}`);
    return { success: true, newInvoiceId: quotationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error converting quotation to invoice' };
  }
}
