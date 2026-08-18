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
  projectDate?: string;
  notes?: string;
  bankAccountId?: string;
  paymentInstructions?: string;
  isHistorical?: boolean;
  isQuotation?: boolean;
  discountAmount?: number;
  lineItems: LineItem[];
  assignedWorkspaceId?: string;
  taxCalculationType?: 'include' | 'exclude' | 'none';
  hasPpn?: boolean;
  hasPph?: boolean;
  pphRate?: number;
  pphAmount?: number;
  dppAmount?: number;
  taxAmount?: number;
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

    const { data: wsData } = await supabase.from('workspaces').select('name').eq('id', inv.workspace_id).single();
    let isNewWave = wsData && wsData.name.toLowerCase().includes('new wave');
    
    if (!isNewWave && inv.assigned_workspace_id) {
      const { data: assignedWsData } = await supabase.from('workspaces').select('name').eq('id', inv.assigned_workspace_id).single();
      if (assignedWsData && assignedWsData.name.toLowerCase().includes('new wave')) {
        isNewWave = true;
      }
    }

    if (!isNewWave) {
      return { success: true }; // Silently succeed without pushing
    }
    
    const clientName = Array.isArray(inv.clients) ? inv.clients[0]?.name : inv.clients?.name;

    const rawLineItems = Array.isArray(inv.invoice_line_items) ? inv.invoice_line_items : (inv.invoice_line_items ? [inv.invoice_line_items] : []);

    // Extract project_date from the [ProjectDate:YYYY-MM-DD] tag stored in notes.
    // If not set, fall back to invoice_date so New Wave always receives an explicit value.
    const projectDateMatch = (inv.notes || '').match(/\[ProjectDate:([^\]]+)\]/);
    const project_date = projectDateMatch ? projectDateMatch[1] : inv.issue_date;

    const payload = {
      source: 'proone',
      external_id: inv.id,
      invoice_number: inv.invoice_number,
      brand: clientName || 'Unknown Client',
      invoice_date: inv.issue_date,
      project_date,          // NEW — Tgl Project (falls back to invoice_date if not set)
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
    let totalAmount = Math.max(0, subtotal - globalDiscount);
    if (payload.taxCalculationType && payload.taxCalculationType !== 'none') {
      const dpp = Number(payload.dppAmount) || 0;
      const tax = Number(payload.taxAmount) || 0;
      const pph = Math.ceil(Number(payload.pphAmount) || 0); // PPH always rounds UP
      totalAmount = dpp + tax - pph;
    }

    const updateData: any = {
      client_id: payload.clientId,
      invoice_number: payload.invoiceNumber,
      is_quotation: payload.isQuotation || false,
      issue_date: payload.issueDate,
      due_date: payload.dueDate,
      subtotal: subtotal,
      total_amount: totalAmount,
      discount_amount: globalDiscount,
      tax_amount: payload.taxAmount || 0,
      tax_calculation_type: payload.taxCalculationType || 'none',
      has_ppn: payload.hasPpn || false,
      has_pph: payload.hasPph || false,
      pph_rate: payload.pphRate || 2,
      pph_amount: payload.pphAmount || 0,
      dpp_amount: payload.dppAmount || 0,
      notes: payload.projectDate ? `[ProjectDate:${payload.projectDate}]\n${payload.notes || ''}`.trim() : (payload.notes || null),
      bank_account_id: payload.bankAccountId || null,
      payment_instructions: payload.paymentInstructions || null,
      assigned_workspace_id: payload.assignedWorkspaceId || null,
      updated_at: new Date().toISOString(),
    };

    let updateQuery = supabase
      .from('invoices')
      .update(updateData)
      .eq('id', payload.id);
      
    if (workspaceId !== '11111111-1111-1111-1111-111111111111') {
      updateQuery = updateQuery.or(`workspace_id.eq.${workspaceId},assigned_workspace_id.eq.${workspaceId}`);
    }
    
    let { error: updateError } = await updateQuery;

    // Fallback: if schema cache doesn't know about the new tax columns, strip and retry
    if (updateError && (updateError.code === '42703' || updateError.message?.includes('does not exist') || updateError.message?.includes('Could not find the'))) {
      const safeUpdate = { ...updateData };
      delete safeUpdate.tax_calculation_type;
      delete safeUpdate.has_ppn;
      delete safeUpdate.has_pph;
      delete safeUpdate.pph_rate;
      delete safeUpdate.pph_amount;
      delete safeUpdate.dpp_amount;
      delete safeUpdate.bank_account_id;
      delete safeUpdate.payment_instructions;
      let retryQuery = supabase
        .from('invoices')
        .update(safeUpdate)
        .eq('id', payload.id);
        
      if (workspaceId !== '11111111-1111-1111-1111-111111111111') {
        retryQuery = retryQuery.or(`workspace_id.eq.${workspaceId},assigned_workspace_id.eq.${workspaceId}`);
      }
      
      const retry = await retryQuery;
      updateError = retry.error;
    }

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
      unit_price: Math.round(Number(item.unitPrice) || 0),
      discount_amount: Math.round(Number(item.discountAmount) || 0),
      sort_order: idx + 1,
    }));

    const { error: linesError } = await supabase.from('invoice_line_items').insert(lineItemsData);
    if (linesError) {
      return { success: false, error: 'Invoice updated, but line items failed to save.' };
    }

    // New Double-Entry logic (replace old entries)
    if (!payload.isQuotation && totalAmount > 0) {
      const mappings = await getWorkspaceMappings(workspaceId);
      let salesAccount = mappings.find(m => m.mapping_type === 'SALES')?.account_code || '4000';
    if (salesAccount === '4001') salesAccount = '4000';
      let arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1200';
    if (arAccount === '1002') arAccount = '1200';

      await supabase.from('journal_entries').delete().eq('reference_id', payload.id).eq('reference_type', 'invoice');
      
      const { error: jeErr } = await supabase.from('journal_entries').insert([
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

    // Attempt to sync to New Wave API in case it was just assigned to New Wave
    const syncRes = await syncInvoiceToNewWave(invoiceId, supabase);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    
    if (syncRes && !syncRes.success) {
      return { success: true, invoiceId, error: `Assigned successfully, but New Wave sync failed: ${syncRes.error}` };
    }

    return { success: true, invoiceId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update assignment.' };
  }
}

export async function updateInvoiceProjectDate(invoiceId: string, newDate: string): Promise<InvoiceActionResult> {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    // Fetch existing notes
    let query = supabase.from('invoices').select('notes').eq('id', invoiceId);
    if (workspaceId !== '11111111-1111-1111-1111-111111111111') {
      query = query.or(`workspace_id.eq.${workspaceId},assigned_workspace_id.eq.${workspaceId}`);
    }
    
    const { data: inv } = await query.single();
    if (!inv) throw new Error('Invoice not found or unauthorized');

    let oldNotes = inv.notes || '';
    let newNotes = '';
    
    if (oldNotes.match(/\[ProjectDate:([^\]]+)\]/)) {
      if (newDate) {
        newNotes = oldNotes.replace(/\[ProjectDate:([^\]]+)\]/, `[ProjectDate:${newDate}]`);
      } else {
        newNotes = oldNotes.replace(/\[ProjectDate:([^\]]+)\]\n?/, '');
      }
    } else {
      if (newDate) {
        newNotes = `[ProjectDate:${newDate}]\n${oldNotes}`.trim();
      } else {
        newNotes = oldNotes;
      }
    }

    let updateQuery = supabase
      .from('invoices')
      .update({ notes: newNotes })
      .eq('id', invoiceId);
      
    if (workspaceId !== '11111111-1111-1111-1111-111111111111') {
      updateQuery = updateQuery.or(`workspace_id.eq.${workspaceId},assigned_workspace_id.eq.${workspaceId}`);
    }

    const { error } = await updateQuery;
    if (error) throw new Error(error.message);

    // Skip revalidatePath('/invoices') here to prevent the Server Component from 
    // force-refreshing the table row, which destroys the native <input type="date"> DOM node 
    // and causes the picker popup to abruptly close while the user is still interacting with it.
    // revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);

    // Fire-and-forget sync to New Wave in the background (non-blocking)
    syncInvoiceToNewWave(invoiceId, supabase).catch(err => {
      console.warn('New Wave sync after project date update failed silently:', err);
    });

    return { success: true, invoiceId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update project date.' };
  }
}

/**
 * Server Action: Re-sync ALL New Wave invoices to the New Wave app.
 * Useful for back-filling project_date on existing invoices.
 */
export async function bulkResyncToNewWave(): Promise<{ success: boolean; synced: number; errors: string[] }> {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    // Get all New Wave workspaces
    const { data: newWaveWs } = await supabase
      .from('workspaces')
      .select('id')
      .ilike('name', '%new wave%');

    if (!newWaveWs || newWaveWs.length === 0) {
      return { success: false, synced: 0, errors: ['No New Wave workspace found'] };
    }

    const nwIds = newWaveWs.map((w: any) => w.id);

    // Fetch all invoices owned by or assigned to New Wave
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id')
      .or(nwIds.map((id: string) => `workspace_id.eq.${id},assigned_workspace_id.eq.${id}`).join(','));

    if (!invoices || invoices.length === 0) {
      return { success: true, synced: 0, errors: [] };
    }

    const errors: string[] = [];
    let synced = 0;

    for (const inv of invoices) {
      const res = await syncInvoiceToNewWave(inv.id, supabase);
      if (res.success) {
        synced++;
      } else {
        errors.push(`${inv.id}: ${res.error}`);
      }
    }

    return { success: true, synced, errors };
  } catch (err: any) {
    return { success: false, synced: 0, errors: [err?.message || 'Unknown error'] };
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
    let totalAmount = Math.max(0, subtotal - globalDiscount);
    if (payload.taxCalculationType && payload.taxCalculationType !== 'none') {
      const dpp = Number(payload.dppAmount) || 0;
      const tax = Number(payload.taxAmount) || 0;
      const pph = Number(payload.pphAmount) || 0;
      totalAmount = dpp + tax - pph;
    }

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
        status: 'draft',
        issue_date: payload.issueDate,
        due_date: payload.dueDate,
        subtotal: subtotal,
        total_amount: totalAmount,
        discount_amount: globalDiscount,
        tax_amount: payload.taxAmount || 0,
        tax_calculation_type: payload.taxCalculationType || 'none',
        has_ppn: payload.hasPpn || false,
        has_pph: payload.hasPph || false,
        pph_rate: payload.pphRate || 2,
        pph_amount: payload.pphAmount || 0,
        dpp_amount: payload.dppAmount || 0,
        notes: payload.projectDate ? `[ProjectDate:${payload.projectDate}]\n${payload.notes || ''}`.trim() : (payload.notes || null),
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
        delete insertData.tax_calculation_type;
        delete insertData.has_ppn;
        delete insertData.has_pph;
        delete insertData.pph_rate;
        delete insertData.pph_amount;
        delete insertData.dpp_amount;
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
      unit_price: Math.round(Number(item.unitPrice) || 0),
      discount_amount: Math.round(Number(item.discountAmount) || 0),
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
      let salesAccount = mappings.find(m => m.mapping_type === 'SALES')?.account_code || '4000';
    if (salesAccount === '4001') salesAccount = '4000';
      let arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1200';
    if (arAccount === '1002') arAccount = '1200';

      const { error: jeErr } = await supabase.from('journal_entries').insert([
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

    let origQuery = supabase.from('invoices').select('*').eq('id', invoiceId);
    if (workspaceId !== '11111111-1111-1111-1111-111111111111') {
      origQuery = origQuery.or(`workspace_id.eq.${workspaceId},assigned_workspace_id.eq.${workspaceId}`);
    }
    const { data: orig, error: fetchErr } = await origQuery.single();

    if (fetchErr || !orig) {
      return { success: false, error: 'Original invoice not found or access denied.' };
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
    const copyNumber = `INV-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newInv, error: dupErr } = await supabase
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
        client_id: orig.client_id,
        invoice_number: copyNumber,
        status: 'draft',
        is_quotation: orig.is_quotation || false,
        issue_date: issueDateStr,
        due_date: dueDateStr,
        subtotal: orig.subtotal,
        total_amount: orig.total_amount,
        discount_amount: orig.discount_amount || 0,
        tax_amount: orig.tax_amount || 0,
        notes: orig.notes,
        bank_account_id: orig.bank_account_id || null,
        payment_instructions: orig.payment_instructions || null,
        assigned_workspace_id: orig.assigned_workspace_id || workspaceId,
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
        package_name: l.package_name || null,
        description: l.description,
        quantity: l.quantity,
        scale: l.scale || 'pc',
        unit_price: l.unit_price,
        discount_amount: l.discount_amount || 0,
        sort_order: l.sort_order,
      }));
      await supabase.from('invoice_line_items').insert(linesToInsert);
    }

    revalidatePath('/invoices');
    revalidatePath('/');

    // Sync the new duplicate to New Wave (it has a fresh UUID = stable external_id for New Wave)
    // This is non-fatal: a failure here won't block the duplication from succeeding.
    await syncInvoiceToNewWave(newInv.id, supabase);

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
        let debitAccountCode = chosenBank?.coa_account_code || '1000';
    if (debitAccountCode === '1010' || debitAccountCode === '1001') debitAccountCode = '1000';
        const todayStr = new Date().toISOString().split('T')[0];

        const mappings = await getWorkspaceMappings(workspaceId);
        let arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1200';
    if (arAccount === '1002') arAccount = '1200';

        // Clean up any prior payment JE for this invoice just in case
        await supabase.from('journal_entries').delete().eq('reference_id', invoiceId).eq('reference_type', 'payment');

        const { error: jeErr } = await supabase.from('journal_entries').insert([
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

    const { createAdminClient } = await import('@/lib/api/supabase-admin');
    const adminClient = createAdminClient();

    // ── Step 0: Push DELETE to New Wave BEFORE removing locally ──────────────
    // Fetch the invoice workspace to check if it belongs to New Wave
    const { data: invForSync } = await supabase
      .from('invoices')
      .select('id, workspace_id, workspaces:workspace_id(name)')
      .eq('id', invoiceId)
      .single();

    if (invForSync) {
      const wsName: string = (Array.isArray(invForSync.workspaces)
        ? (invForSync.workspaces as any[])[0]?.name
        : (invForSync.workspaces as any)?.name) || '';

      if (wsName.toLowerCase().includes('new wave')) {
        const apiKey = process.env.ACCOUNTING_API_KEY || process.env.NEWWAVE_INTEGRATION_TOKEN;
        if (apiKey) {
          try {
            await fetch(
              `https://app.newwave.id/api/accounting/invoices?source=proone&external_id=${invoiceId}`,
              { method: 'DELETE', headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
          } catch (syncErr) {
            console.warn('New Wave DELETE sync failed (non-fatal):', syncErr);
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    await adminClient
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('workspace_id', workspaceId);

    // Delete associated ledger entries
    await adminClient.from('journal_entries').delete().eq('reference_id', invoiceId);

    const { error } = await adminClient
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId);

    // Also attempt to delete from transactions (for Quick Incomes labeled as 'DIRECT INCOME')
    const { error: txError } = await adminClient
      .from('transactions')
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
export async function recordInvoicePayment(invoiceId: string, amount: number, paymentDate: string, paymentMethod: string, reference?: string, transferToWorkspaceId?: string, bankAccountId?: string) {
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
    
    // Determine new status
    let newStatus = inv.status;
    if (isFullyPaid) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial_paid';
    } else {
      newStatus = 'sent'; // 0 payment - mark as sent/invoiced
    }

    // 2. Insert Transaction (Only if amount > 0)
    let newTxId = '';
    if (amount > 0) {
      const { data: txData, error: txErr } = await supabase.from('transactions').insert({
      workspace_id: workspaceId,
      type: 'income',
      category: 'Client Payment',
      amount: amount,
      transaction_date: paymentDate,
      description: `Payment for ${inv.invoice_number}${reference ? ' - ' + reference : ''}`,
      client_id: inv.client_id,
      invoice_id: inv.id,
      payment_method: paymentMethod,
      bank_reference: bankAccountId || null
    }).select('id').single();

    if (txErr) throw new Error('Failed to create payment transaction.');
    newTxId = txData.id;

    // 3. Ledger Double-Entry
    const mappings = await getWorkspaceMappings(workspaceId);
    let arAccount = mappings.find(m => m.mapping_type === 'AR')?.account_code || '1200';
    if (arAccount === '1002') arAccount = '1200';
    
    let chosenBank: any = null;
    let debitAccountCode = '1000';
    
    if (bankAccountId === 'cash') {
      debitAccountCode = '1000';
      chosenBank = { id: 'cash', bank_name: 'Cash', coa_account_code: '1000' };
    } else if (bankAccountId && bankAccountId !== 'all' && bankAccountId !== 'custom') {
      const { data: bankRes } = await supabase.from('workspace_bank_accounts').select('*').eq('id', bankAccountId).single();
      if (bankRes) chosenBank = bankRes;
    }
    
    if (!chosenBank && inv.bank_account_id && inv.bank_account_id !== 'all' && inv.bank_account_id !== 'custom') {
      const { data: bankRes } = await supabase.from('workspace_bank_accounts').select('*').eq('id', inv.bank_account_id).single();
      if (bankRes) chosenBank = bankRes;
    }
    
    if (!chosenBank) {
      const { data: firstBank } = await supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', workspaceId).order('is_default', { ascending: false }).limit(1);
      if (firstBank && firstBank.length > 0) chosenBank = firstBank[0];
    }
    
    if (chosenBank && bankAccountId !== 'cash') {
      debitAccountCode = chosenBank.coa_account_code || '1000';
    }
    
    if (debitAccountCode === '1010' || debitAccountCode === '1001') debitAccountCode = '1000';

      const todayStr = paymentDate || new Date().toISOString().split('T')[0];
      
      const { error: jeErr } = await supabase.from('journal_entries').insert([
        { workspace_id: workspaceId, account_code: debitAccountCode, transaction_date: todayStr, debit_amount: amount, credit_amount: 0, description: `Payment for Invoice ${inv.invoice_number}${reference ? ' - ' + reference : ''}`, reference_id: newTxId || invoiceId, reference_type: 'payment_tx' },
        { workspace_id: workspaceId, account_code: arAccount, transaction_date: todayStr, debit_amount: 0, credit_amount: amount, description: `Payment for Invoice ${inv.invoice_number}${reference ? ' - ' + reference : ''}`, reference_id: newTxId || invoiceId, reference_type: 'payment_tx' }
      ]);

      // If transferring to another workspace, create Expense here and Direct Income there
      if (transferToWorkspaceId && transferToWorkspaceId !== workspaceId) {
        // 1. Expense in current workspace (Transfer Out)
        await supabase.from('transactions').insert({
          workspace_id: workspaceId,
          type: 'expense',
          category: 'Inter-Company Transfer Out',
          amount: amount,
          transaction_date: paymentDate,
          description: `Auto-transfer out for Invoice ${inv.invoice_number}`,
          payment_method: paymentMethod
        });

        // 2. Direct Income in target workspace (Transfer In)
        await supabase.from('transactions').insert({
          workspace_id: transferToWorkspaceId,
          type: 'income',
          category: 'Direct Income (Inter-Company)',
          amount: amount,
          transaction_date: paymentDate,
          description: `Auto-transfer in from Invoice ${inv.invoice_number}`,
          payment_method: paymentMethod
        });
      }
    }

    // 4. Update Invoice
    const { error: invErr } = await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', invoiceId);

    if (invErr) throw new Error('Failed to update invoice balance. ' + (invErr.message || JSON.stringify(invErr)));

    await syncInvoiceToNewWave(invoiceId, supabase);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/ledger');
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error recording payment.' };
  }
}

export async function getInvoicePayments(invoiceId: string) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const { data: txs, error } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        transaction_date,
        payment_method,
        description,
        bank_reference
      `)
      .eq('invoice_id', invoiceId)
      .eq('workspace_id', workspaceId)
      .eq('type', 'income')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch bank accounts to map names
    const { data: banks } = await supabase.from('workspace_bank_accounts').select('id, bank_name, account_number').eq('workspace_id', workspaceId);

    const payments = (txs || []).map(tx => {
      const bank = banks?.find(b => b.id === tx.bank_reference);
      let bName = bank ? `${bank.bank_name} - ${bank.account_number}`.replace(/ - $/, '') : null;
      if (tx.bank_reference === 'cash') bName = 'Cash (Manual)';
      
      return {
        id: tx.id,
        amount: Number(tx.amount || 0),
        date: tx.transaction_date,
        method: tx.payment_method,
        description: tx.description,
        bankAccountId: tx.bank_reference,
        bankName: bName
      };
    });

    return { success: true, payments, bankAccounts: banks || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error fetching payments.', payments: [], bankAccounts: [] };
  }
}

export async function deleteInvoicePayment(transactionId: string, invoiceId: string) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    // 1. Fetch the transaction to ensure it exists and get its amount
    const { data: tx, error: fetchErr } = await supabase
      .from('transactions')
      .select('amount')
      .eq('id', transactionId)
      .eq('invoice_id', invoiceId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchErr || !tx) throw new Error('Payment not found or you do not have permission to delete it.');

    // 2. Delete the specific transaction
    await supabase.from('transactions').delete().eq('id', transactionId).eq('workspace_id', workspaceId);

    // 3. Delete the associated journal entries using reference_id = transaction.id
    // If it's an old payment, the journal entries might use reference_id = invoiceId. We delete both just in case,
    // but wait! We can't delete by invoiceId broadly or we lose other payments!
    // We will delete explicitly by transactionId. If it's an old payment, we use a fuzzy match to delete exactly 2 rows.
    const { data: exactJEs } = await supabase.from('journal_entries').select('id').eq('reference_id', transactionId);
    if (exactJEs && exactJEs.length > 0) {
      await supabase.from('journal_entries').delete().eq('reference_id', transactionId);
    } else {
      // Fuzzy match for old payments (matching amount, date, and invoiceId)
      // This is a best-effort cleanup for old legacy payments
      const { data: legacyJEs } = await supabase.from('journal_entries')
        .select('id')
        .eq('reference_id', invoiceId)
        .eq('reference_type', 'payment')
        .or(`debit_amount.eq.${tx.amount},credit_amount.eq.${tx.amount}`)
        .limit(2);
      
      if (legacyJEs && legacyJEs.length > 0) {
        const idsToDelete = legacyJEs.map(j => j.id);
        await supabase.from('journal_entries').delete().in('id', idsToDelete);
      }
    }

    // 4. Recalculate Invoice amount_paid
    const { data: allRemainingTxs } = await supabase
      .from('transactions')
      .select('amount')
      .eq('invoice_id', invoiceId)
      .eq('workspace_id', workspaceId)
      .eq('type', 'income');

    const totalPaidNow = (allRemainingTxs || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const { data: inv } = await supabase.from('invoices').select('total_amount').eq('id', invoiceId).single();
    let newStatus = 'sent';
    if (inv) {
      if (totalPaidNow >= Number(inv.total_amount)) newStatus = 'paid';
      else if (totalPaidNow > 0) newStatus = 'partial_paid';
      else newStatus = 'sent'; // zero
    }

    await supabase.from('invoices').update({
      amount_paid: totalPaidNow,
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', invoiceId).eq('workspace_id', workspaceId);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/ledger');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting payment.' };
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
