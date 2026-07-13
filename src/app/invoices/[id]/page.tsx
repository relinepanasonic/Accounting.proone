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

  const clientName = clientObj?.name || 'Richard H. Jonas';
  const clientContact = clientObj?.email || 'Account Manager';
  const clientAddress = clientObj?.company || 'A : 5551 West Street, Ankeny, IA 50023';
  const clientPhone = clientObj?.phone || 'P : +1-002/555-0153';

  const items: InvoiceItemData[] =
    lineItems && lineItems.length > 0
      ? lineItems.map((l: any) => ({
          id: l.id,
          deliveryDate: invoiceDate,
          description: l.description,
          unitPrice: Number(l.unit_price || 0),
          quantity: Number(l.quantity || 1),
          total: Number(l.unit_price || 0) * Number(l.quantity || 1),
        }))
      : [
          {
            id: '1',
            deliveryDate: invoiceDate,
            description: 'TikTok Live Commerce Monthly Production Retainer',
            unitPrice: 85000000,
            quantity: 1,
            total: 85000000,
          },
          {
            id: '2',
            deliveryDate: invoiceDate,
            description: 'Custom HD Video Creator Package (40 Ads Production)',
            unitPrice: 1621750,
            quantity: 40,
            total: 64870000,
          },
        ];

  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const taxAmount = Math.round(subtotal * 0.11);
  const grandTotal = subtotal + taxAmount;

  return (
    <InvoicePDFDocument
      invoiceNumber={invoiceNumber}
      accountNumber={`#${invoiceNumber}`}
      invoiceDate={invoiceDate}
      issueDate={issueDate}
      clientName={clientName}
      clientContact={clientContact}
      clientAddress={clientAddress}
      clientPhone={clientPhone}
      items={items}
      subtotal={subtotal}
      taxAmount={taxAmount}
      grandTotal={grandTotal}
    />
  );
}
