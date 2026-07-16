import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvoicePDFDocument, type InvoiceItemData } from '@/components/invoices/InvoicePDFDocument';

export const dynamic = 'force-dynamic';

interface QuotationPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuotationDetailPage({ params }: QuotationPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Try fetching from dedicated quotations table
  let quoObj: any = null;
  let lineItems: any[] = [];
  let clientObj: any = null;

  const { data: quoData } = await supabase
    .from('quotations')
    .select('*, clients(*)')
    .eq('id', id)
    .single();

  if (quoData) {
    quoObj = quoData;
    clientObj = Array.isArray(quoObj.clients) ? quoObj.clients[0] : quoObj.clients;
    const { data: items } = await supabase
      .from('quotation_line_items')
      .select('*')
      .eq('quotation_id', id)
      .order('sort_order', { ascending: true });
    lineItems = items || [];
  } else {
    // 2. Fallback: check if stored inside invoices table with status = 'quotation'
    const { data: invData } = await supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('id', id)
      .single();

    if (!invData) {
      return notFound();
    }
    quoObj = invData;
    clientObj = Array.isArray(quoObj.clients) ? quoObj.clients[0] : quoObj.clients;
    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order', { ascending: true });
    lineItems = items || [];
  }

  const workspaceId = quoObj.workspace_id || '';

  // 3. Fetch workspace Brand ID details and bank accounts
  let wsObj: any = null;
  let bankAccounts: any[] = [];
  if (workspaceId) {
    const [wsRes, accountsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', workspaceId).order('is_default', { ascending: false }),
    ]);
    wsObj = wsRes.data;
    if (accountsRes.data && accountsRes.data.length > 0) {
      bankAccounts = accountsRes.data;
    } else if (wsObj?.payment_instructions) {
      const lines = wsObj.payment_instructions.split('\n').filter((l: string) => l.trim().length > 0);
      bankAccounts = lines.map((l: string, idx: number) => ({
        bank_name: idx === 0 ? 'Bank Account' : `Bank (${idx + 1})`,
        account_number: l.trim(),
        account_name: wsObj.name || 'Company Account',
      }));
    }
  }

  const quoteNumber = quoObj.quotation_number || quoObj.invoice_number || 'QUO-2026-001';
  const issueDate = quoObj.issue_date
    ? new Date(quoObj.issue_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '15 Jul, 2026';

  const validUntil = quoObj.valid_until || quoObj.due_date
    ? new Date(quoObj.valid_until || quoObj.due_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '30 Jul, 2026';

  const clientName = clientObj?.name || 'Client Payee';
  const clientBrand = clientObj?.company_name || clientObj?.company || '';
  const clientContact = clientObj?.contact_name || clientObj?.name || '';
  const clientAddress = clientObj?.billing_address || clientObj?.address || '';
  const clientPhone = clientObj?.phone || '';
  const clientEmail = clientObj?.email || '';

  const items: InvoiceItemData[] =
    lineItems && lineItems.length > 0
      ? lineItems.map((l: any, idx: number) => ({
          id: l.id || `item-${idx}`,
          deliveryDate: issueDate,
          description: l.description,
          unitPrice: Number(l.unit_price || 0),
          quantity: 1,
          total: Number(l.unit_price || 0),
        }))
      : [];

  const workspaceBrand = {
    name: wsObj?.name || 'Workspace Enterprise',
    logoUrl: wsObj?.logo_url || wsObj?.company_logo_url || '',
    tagline: wsObj?.brand_tagline || wsObj?.tagline || '',
    phone: wsObj?.contact_phone || wsObj?.phone || '',
    email: wsObj?.official_email || wsObj?.email || '',
    website: wsObj?.website_url || wsObj?.website || '',
    address: wsObj?.billing_address || wsObj?.address || '',
    isTaxRegistered: Boolean(wsObj?.is_tax_registered),
    taxRatePercent: wsObj?.tax_rate_percent ? Number(wsObj.tax_rate_percent) : 0,
    bankAccounts: bankAccounts,
  };

  return (
    <InvoicePDFDocument
      invoiceNumber={quoteNumber}
      accountNumber={`#${quoteNumber}`}
      invoiceDate={issueDate}
      issueDate={validUntil}
      clientName={clientName}
      clientBrand={clientBrand}
      clientContact={clientContact}
      clientAddress={clientAddress}
      clientPhone={clientPhone}
      clientEmail={clientEmail}
      items={items}
      subtotal={0}
      taxAmount={0}
      grandTotal={0}
      workspaceBrand={workspaceBrand}
      documentType="QUOTATION"
    />
  );
}
