'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export interface CreateQuotationPayload {
  clientId: string;
  quotationNumber: string;
  issueDate: string;
  validUntil: string;
  notes?: string;
  lineItems: Array<{
    description: string;
    unitPrice: number;
  }>;
}

export interface QuotationActionResult {
  success: boolean;
  quotationId?: string;
  error?: string;
}

export async function createQuotation(payload: CreateQuotationPayload): Promise<QuotationActionResult> {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId: workspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    if (!payload.clientId) {
      return { success: false, error: 'Client Payee is required.' };
    }

    if (!payload.lineItems || payload.lineItems.length === 0) {
      return { success: false, error: 'At least one deliverable item is required.' };
    }

    // Try inserting into dedicated quotations table
    const { data: quo, error: quoError } = await supabase
      .from('quotations')
      .insert({
        workspace_id: workspaceId,
        client_id: payload.clientId,
        quotation_number: payload.quotationNumber || `QUO-2026-${Math.floor(100 + Math.random() * 900)}`,
        status: 'draft',
        issue_date: payload.issueDate,
        valid_until: payload.validUntil,
        notes: payload.notes || null,
      })
      .select('id')
      .single();

    if (!quoError && quo) {
      const lineItemsData = payload.lineItems.map((item, idx) => ({
        workspace_id: workspaceId,
        quotation_id: quo.id,
        description: item.description || 'Pitch Deliverable',
        unit_price: Number(item.unitPrice) || 0,
        sort_order: idx + 1,
      }));

      await supabase.from('quotation_line_items').insert(lineItemsData);
      revalidatePath('/quotations');
      return { success: true, quotationId: quo.id };
    }

    // Fallback if quotations table is not yet created in Supabase: store in invoices table with status = 'quotation'
    const totalAmount = payload.lineItems.reduce((acc, item) => acc + (Number(item.unitPrice) || 0), 0);
    const { data: fallbackInv, error: invError } = await supabase
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
        client_id: payload.clientId,
        invoice_number: payload.quotationNumber || `QUO-2026-${Math.floor(100 + Math.random() * 900)}`,
        status: 'quotation',
        issue_date: payload.issueDate,
        due_date: payload.validUntil,
        subtotal: totalAmount,
        total_amount: totalAmount,
        notes: '[QUOTATION] ' + (payload.notes || ''),
      })
      .select('id')
      .single();

    if (invError || !fallbackInv) {
      return {
        success: false,
        error: `Database error inserting quotation: ${invError?.message || quoError?.message || 'Unknown error'}`,
      };
    }

    const fallbackLineItemsData = payload.lineItems.map((item, idx) => ({
      workspace_id: workspaceId,
      invoice_id: fallbackInv.id,
      description: item.description || 'Pitch Deliverable',
      quantity: 1,
      unit_price: Number(item.unitPrice) || 0,
      sort_order: idx + 1,
    }));

    await supabase.from('invoice_line_items').insert(fallbackLineItemsData);

    revalidatePath('/quotations');
    return { success: true, quotationId: fallbackInv.id };
  } catch (err: any) {
    console.error('Exception in createQuotation:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while creating the quotation.',
    };
  }
}
