import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { InvoicePDFDocument, InvoiceItemData } from '@/components/invoices/InvoicePDFDocument';

export const dynamic = 'force-dynamic';

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = await createClient();

  // 1. Fetch parent invoice
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, clients(*)')
    .eq('id', id)
    .single();

  // 2. Fetch line items
  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  const clientObj = Array.isArray(inv?.clients) ? inv?.clients[0] : inv?.clients;
  const workspaceId = inv?.workspace_id || '';

  // 3. Fetch workspace and bank accounts
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

  const invoiceNumber = inv?.invoice_number || 'INV-2026-004';
  const issueDate = inv?.issue_date
    ? new Date(inv.issue_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '16 Jul, 2026';

  const invoiceDate = inv?.created_at
    ? new Date(inv.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '15 Jul, 2026';

  const clientName = clientObj?.name || 'Client Payee';
  const clientBrand = clientObj?.company_name || clientObj?.company || '';
  const clientContact = clientObj?.contact_name || clientObj?.name || '';
  const clientAddress = clientObj?.billing_address || clientObj?.address || '';
  const clientPhone = clientObj?.phone || '';
  const clientEmail = clientObj?.email || '';

  const items =
    lineItems && lineItems.length > 0
      ? lineItems.map((l: any) => ({
          id: l.id,
          deliveryDate: invoiceDate,
          description: l.description,
          unitPrice: Number(l.unit_price || 0),
          quantity: Number(l.quantity || 1),
          total: Number(l.unit_price || 0) * Number(l.quantity || 1),
        }))
      : [];

  const subtotal = items.reduce((acc, item) => acc + item.total, 0);

  const isTaxReg =
    wsObj?.is_tax_registered !== undefined && wsObj?.is_tax_registered !== null
      ? Boolean(wsObj.is_tax_registered)
      : Number(wsObj?.tax_rate_percent || 0) > 0;
  const taxRate = wsObj?.tax_rate_percent !== undefined ? Number(wsObj.tax_rate_percent) : (isTaxReg ? 11 : 0);
  const taxAmount = isTaxReg ? Math.round(subtotal * (taxRate / 100)) : 0;
  const grandTotal = subtotal + taxAmount;

  const workspaceBrand = {
    name: wsObj?.name || 'Workspace Enterprise',
    logoUrl: wsObj?.logo_url || wsObj?.company_logo_url || '',
    tagline: wsObj?.brand_tagline || wsObj?.tagline || '',
    phone: wsObj?.contact_phone || wsObj?.phone || '',
    email: wsObj?.official_email || wsObj?.email || '',
    website: wsObj?.website_url || wsObj?.website || '',
    address: wsObj?.billing_address || wsObj?.address || '',
    isTaxRegistered: isTaxReg,
    taxRatePercent: taxRate,
    bankAccounts: bankAccounts,
  };

  return (
    <InvoicePDFDocument
      invoiceNumber={invoiceNumber}
      accountNumber={`#${invoiceNumber}`}
      invoiceDate={invoiceDate}
      issueDate={issueDate}
      clientName={clientName}
      clientBrand={clientBrand}
      clientContact={clientContact}
      clientAddress={clientAddress}
      clientPhone={clientPhone}
      clientEmail={clientEmail}
      items={items}
      subtotal={subtotal}
      taxAmount={taxAmount}
      grandTotal={grandTotal}
      workspaceBrand={workspaceBrand}
      documentType="INVOICE"
    />
  );
}
