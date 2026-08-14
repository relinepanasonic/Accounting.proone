import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { InvoicePDFDocument, InvoiceItemData } from '@/components/invoices/InvoicePDFDocument';

export const dynamic = 'force-dynamic';

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvoiceDetailPage({ params, searchParams }: InvoiceDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { id } = resolvedParams;
  const isReceipt = resolvedSearchParams?.receipt === 'true';
  const supabase = await createClient();

  // 1. Fetch parent invoice with relational joins
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, clients(*), invoice_line_items(*), workspaces!invoices_workspace_id_fkey(*), transactions(*)')
    .eq('id', id)
    .single();

  // 2. Extract line items directly or fallback to query
  const lineItems =
    Array.isArray(inv?.invoice_line_items) && inv.invoice_line_items.length > 0
      ? [...inv.invoice_line_items].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      : (await supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('sort_order', { ascending: true })).data;

  const clientObj = Array.isArray(inv?.clients) ? inv?.clients[0] : inv?.clients;
  const wsObjFromJoin = Array.isArray(inv?.workspaces) ? inv?.workspaces[0] : inv?.workspaces;
  const workspaceId = inv?.workspace_id || wsObjFromJoin?.id || '';

  // 3. Fetch workspace (if join missed) and bank accounts
  let wsObj: any = wsObjFromJoin || null;
  let bankAccounts: any[] = [];
  if (workspaceId) {
    const [wsRes, accountsRes] = await Promise.all([
      wsObj ? Promise.resolve({ data: wsObj }) : supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabase.from('workspace_bank_accounts').select('*').eq('workspace_id', workspaceId).order('is_default', { ascending: false }),
    ]);
    if (!wsObj) wsObj = wsRes.data;

    // Check if a specific bank account or custom instructions were chosen for this invoice
    if (inv?.bank_account_id && inv.bank_account_id !== 'all' && inv.bank_account_id !== 'custom') {
      let chosen = accountsRes.data?.find((a: any) => a.id === inv.bank_account_id);
      if (!chosen) {
        const { data: singleRes } = await supabase.from('workspace_bank_accounts').select('*').eq('id', inv.bank_account_id).single();
        if (singleRes) chosen = singleRes;
      }
      if (chosen) {
        bankAccounts = [chosen];
      }
    } else if (inv?.payment_instructions && inv?.bank_account_id === 'custom') {
      bankAccounts = [
        {
          bank_name: 'Payment Instructions',
          account_number: inv.payment_instructions,
          account_name: wsObj?.name || 'Company Account',
        },
      ];
    }

    if (bankAccounts.length === 0) {
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
  }

  const invoiceNumber = inv?.invoice_number || 'INV-2026-004';
  
  const formatIndoDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const issueDate = inv?.due_date
    ? formatIndoDate(inv.due_date)
    : '16 Jul 2026';

  const invoiceDate = inv?.issue_date
    ? formatIndoDate(inv.issue_date)
    : '15 Jul 2026';

  const clientName = clientObj?.name || 'Client Payee';
  const clientLegalName = clientObj?.company_legal_name || '';
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
          packageName: l.package_name || null,
          description: l.description,
          unitPrice: Number(l.unit_price || 0),
          quantity: Number(l.quantity || 1),
          scale: l.scale || null,
          discountAmount: Number(l.discount_amount || 0),
          total: Number(l.unit_price || 0) * Number(l.quantity || 1) - Number(l.discount_amount || 0),
        }))
      : [];

  const subtotal = items.reduce((acc: number, item: any) => acc + item.total, 0);
  const globalDiscount = Number(inv?.discount_amount || 0);

  const isTaxReg =
    wsObj?.is_tax_registered !== undefined && wsObj?.is_tax_registered !== null
      ? Boolean(wsObj.is_tax_registered)
      : Number(wsObj?.tax_rate_percent || 0) > 0;
  const taxRate = wsObj?.tax_rate_percent !== undefined ? Number(wsObj.tax_rate_percent) : (isTaxReg ? 11 : 0);
  const taxableAmount = Math.max(0, subtotal - globalDiscount);
  
  let taxAmount = isTaxReg ? Math.round(taxableAmount * (taxRate / 100)) : 0;
  let grandTotal = taxableAmount + taxAmount;

  if (inv?.tax_calculation_type && inv.tax_calculation_type !== 'none') {
    taxAmount = Number(inv.tax_amount) || 0;
    grandTotal = Number(inv.total_amount) || 0;
  } else if (inv?.total_amount) {
    grandTotal = Number(inv.total_amount);
  }

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

  const payments = Array.isArray(inv?.transactions) 
    ? inv.transactions.filter((t: any) => t.type === 'income').sort((a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
    : [];

  return (
    <InvoicePDFDocument
      invoiceId={id}
      amountPaid={Number(inv?.amount_paid || 0)}
      payments={payments}
      invoiceNumber={invoiceNumber}
      accountNumber={`#${invoiceNumber}`}
      invoiceDate={invoiceDate}
      rawIssueDate={inv?.issue_date}
      issueDate={issueDate}
      clientName={clientName}
      clientLegalName={clientLegalName}
      clientBrand={clientBrand}
      clientContact={clientContact}
      clientAddress={clientAddress}
      clientPhone={clientPhone}
      clientEmail={clientEmail}
      items={items}
      notes={(inv?.notes || '').replace(/\[ProjectDate:[^\]]+\]\n?/, '')}
      subtotal={subtotal}
      globalDiscount={globalDiscount}
      taxAmount={taxAmount}
      grandTotal={grandTotal}
      workspaceBrand={workspaceBrand}
      documentType={isReceipt ? 'RECEIPT' : inv?.is_quotation ? 'QUOTATION' : 'INVOICE'}
      taxCalculationType={inv?.tax_calculation_type}
      hasPpn={inv?.has_ppn}
      hasPph={inv?.has_pph}
      pphRate={Number(inv?.pph_rate || 2)}
      pphAmount={Number(inv?.pph_amount || 0)}
      dppAmount={Number(inv?.dpp_amount || 0)}
    />
  );
}
