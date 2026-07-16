'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Printer } from 'lucide-react';
import { ProfessorTokoOnlineLogo } from '@/components/invoices/ProfessorTokoOnlineLogo';
import { DescriptionBullets } from '@/components/ui/DescriptionBullets';

export interface InvoiceItemData {
  id: string;
  deliveryDate: string;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface WorkspaceBrandInfo {
  name?: string;
  logoUrl?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  isTaxRegistered?: boolean;
  taxRatePercent?: number;
  bankAccounts?: { bank_name: string; account_number: string; account_name: string }[];
}

export interface InvoiceDocumentProps {
  invoiceNumber: string;
  accountNumber: string;
  invoiceDate: string;
  issueDate: string;
  clientName: string;
  clientBrand?: string;
  clientContact: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail?: string;
  items: InvoiceItemData[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  workspaceBrand?: WorkspaceBrandInfo;
  documentType?: 'INVOICE' | 'QUOTATION';
}

export function InvoicePDFDocument({
  invoiceNumber = 'INV-2026-001',
  accountNumber = '#INV-2026-001',
  invoiceDate = '16 Jul, 2026',
  issueDate = '16 Jul, 2026',
  clientName = 'Client Payee',
  clientBrand = '',
  clientContact = '',
  clientAddress = '',
  clientPhone = '',
  clientEmail = '',
  items = [],
  subtotal = 0,
  taxAmount = 0,
  grandTotal = 0,
  workspaceBrand,
  documentType = 'INVOICE',
}: Partial<InvoiceDocumentProps>) {
  const isQuotation = documentType === 'QUOTATION';

  // Format default filename: NoInvDateClientName.pdf
  useEffect(() => {
    const cleanNum = (invoiceNumber || (isQuotation ? 'QUO' : 'INV')).replace(/[^a-zA-Z0-9-]/g, '');
    const cleanDate = (invoiceDate || issueDate || 'Date').replace(/[^a-zA-Z0-9]/g, '');
    const cleanClient = (clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '');
    const defaultTitle = `${cleanNum}_${cleanDate}_${cleanClient}`;
    document.title = defaultTitle;
  }, [invoiceNumber, invoiceDate, issueDate, clientName, isQuotation]);

  const handlePrintPDF = () => {
    const cleanNum = (invoiceNumber || (isQuotation ? 'QUO' : 'INV')).replace(/[^a-zA-Z0-9-]/g, '');
    const cleanDate = (invoiceDate || issueDate || 'Date').replace(/[^a-zA-Z0-9]/g, '');
    const cleanClient = (clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '');
    document.title = `${cleanNum}_${cleanDate}_${cleanClient}`;
    window.print();
  };

  const brandName = workspaceBrand?.name || 'Workspace Enterprise';
  const brandTagline = workspaceBrand?.tagline || '';
  const brandAddress = workspaceBrand?.address || '';
  const brandPhone = workspaceBrand?.phone || '';
  const brandWebsite = workspaceBrand?.website || '';
  const brandEmail = workspaceBrand?.email || '';

  return (
    <div className="min-h-screen bg-[#0b0c10] py-8 px-4 sm:px-8 print:p-0 print:bg-white text-zinc-800">
      {/* Top Controls Strip (Hidden in Print/PDF mode) */}
      <div className="max-w-[850px] mx-auto mb-6 flex items-center justify-between no-print">
        <Link
          href={isQuotation ? '/quotations' : '/invoices'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-[#d4af37]/30 text-[#f5d77f] hover:bg-[#d4af37]/15 text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO {isQuotation ? 'QUOTATIONS' : 'INVOICES'}</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintPDF}
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4" />
            <span>DOWNLOAD / PRINT {isQuotation ? 'QUOTATION' : 'INVOICE'} PDF</span>
          </button>
        </div>
      </div>

      {/* A4/Letter Document Container */}
      <div className="max-w-[850px] mx-auto bg-white shadow-2xl overflow-hidden print:shadow-none print:max-w-none print:w-full font-sans text-[#2d3748]">
        {/* HEADER SECTION (Dark Navy/Charcoal #1e2536 with Left Gold Accent Strip) */}
        <header className="relative bg-[#1e2536] text-white px-8 sm:px-12 py-9 flex items-center justify-between">
          {/* Vertical Beige/Gold Accent Strip on Far Left Edge */}
          <div className="absolute top-0 left-0 bottom-0 w-3 bg-[#c5a059]" />

          {/* Logo & Branding (Top Left) */}
          <div className="flex items-center gap-4 z-10 pl-2">
            {workspaceBrand?.logoUrl ? (
              <img
                src={workspaceBrand.logoUrl}
                alt={brandName}
                className="w-14 h-14 object-contain shrink-0"
              />
            ) : (
              <ProfessorTokoOnlineLogo className="w-14 h-14 shrink-0" />
            )}
            <div>
              <h1 className="text-xl font-bold tracking-wider uppercase text-white font-serif">
                {brandName}
              </h1>
              <p className="text-[11px] text-[#c5a059] tracking-widest uppercase font-mono mt-0.5">
                {brandTagline}
              </p>
            </div>
          </div>

          {/* Contact Info (Top Right) */}
          <div className="text-right text-[11px] leading-relaxed text-zinc-300 font-sans space-y-1 z-10">
            {brandAddress && <div className="font-semibold text-white">{brandAddress}</div>}
            {brandPhone && <div>{brandPhone}</div>}
            {brandWebsite && <div>{brandWebsite}</div>}
            {brandEmail && <div className="text-[#c5a059]">{brandEmail}</div>}
          </div>
        </header>

        {/* Small Gold Block Below Header Edge */}
        <div className="w-3 h-8 bg-[#e2d5ba]" />

        {/* BODY CONTAINER */}
        <div className="px-8 sm:px-12 pt-2 pb-14 space-y-10">
          {/* META SECTION: Bill To (Left) & Document Title + Details (Right) */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
            {/* Left: Bill To */}
            <div className="space-y-1.5 text-xs">
              <span className="text-sm font-serif italic text-[#c5a059] block mb-1">
                {isQuotation ? 'Prepared For / Pitch To:' : 'Bill To:'}
              </span>
              <div className="text-base font-bold text-[#1e2536] font-serif">
                {clientName}
              </div>
              {clientBrand && <div className="text-zinc-700 font-bold">{clientBrand}</div>}
              {clientContact && clientContact !== clientName && (
                <div className="text-zinc-500 font-medium">{clientContact}</div>
              )}
              <div className="text-zinc-600 pt-1 leading-relaxed">
                {clientAddress && <div>{clientAddress}</div>}
                {clientPhone && <div>{clientPhone}</div>}
                {clientEmail && <div className="text-[#1e2536] font-medium">{clientEmail}</div>}
              </div>
            </div>

            {/* Right: Title & 3-Column Meta Table */}
            <div className="sm:text-right flex flex-col sm:items-end">
              <h2 className="text-4xl font-serif tracking-[0.25em] text-[#1e2536] font-normal mb-3">
                {isQuotation ? 'QUOTATION' : 'INVOICE'}
              </h2>
              <div className="w-full sm:w-80 border-t border-[#1e2536] pt-2 grid grid-cols-3 gap-3 text-center sm:text-left text-[11px]">
                <div>
                  <span className="block text-[10px] text-zinc-400 uppercase font-mono">
                    {isQuotation ? 'Quote Ref' : 'A/C No'}
                  </span>
                  <span className="font-bold text-[#1e2536] font-mono">
                    {accountNumber}
                  </span>
                </div>
                <div className="border-l border-zinc-200 pl-3">
                  <span className="block text-[10px] text-zinc-400 uppercase font-mono">
                    {isQuotation ? 'Quote Date' : 'Invoice Date'}
                  </span>
                  <span className="font-semibold text-[#1e2536]">
                    {invoiceDate}
                  </span>
                </div>
                <div className="border-l border-zinc-200 pl-3">
                  <span className="block text-[10px] text-zinc-400 uppercase font-mono">
                    {isQuotation ? 'Valid Until' : 'Issue Date'}
                  </span>
                  <span className="font-semibold text-[#1e2536]">
                    {issueDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* LINE ITEMS TABLE */}
          <div className="pt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-y-2 border-[#1e2536] text-[#1e2536] uppercase text-[10px] tracking-wider font-bold font-serif">
                  <th className="py-3 px-2 w-28">{isQuotation ? 'PERIOD' : 'DATE'}</th>
                  <th className="py-3 px-2">{isQuotation ? 'DELIVERABLE / SERVICE PITCH' : 'ITEM DESCRIPTION'}</th>
                  <th className="py-3 px-2 text-right">{isQuotation ? 'UNIT INVESTMENT' : 'UNIT PRICE'}</th>
                  {!isQuotation && <th className="py-3 px-2 text-center w-16">QTY</th>}
                  {!isQuotation && <th className="py-3 px-2 text-right">TOTAL</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs">
                {items?.map((item, idx) => (
                  <tr key={item.id || idx} className="text-zinc-700">
                    <td className="py-4 px-2 font-mono text-zinc-500">
                      {item.deliveryDate}
                    </td>
                    <td className="py-4 px-2 font-medium text-[#1e2536]">
                      <DescriptionBullets
                        description={item.description}
                        isDark={false}
                        className="text-xs"
                      />
                    </td>
                    <td className="py-4 px-2 text-right font-mono font-semibold text-[#1e2536]">
                      Rp {item.unitPrice.toLocaleString('id-ID')}
                    </td>
                    {!isQuotation && (
                      <td className="py-4 px-2 text-center font-mono font-semibold">
                        {item.quantity}
                      </td>
                    )}
                    {!isQuotation && (
                      <td className="py-4 px-2 text-right font-mono font-bold text-[#1e2536]">
                        Rp {item.total.toLocaleString('id-ID')}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CALCULATIONS & FOOTER (Only shown for INVOICE mode) */}
          {!isQuotation ? (
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-72 space-y-2 text-xs">
                <div className="flex justify-between py-1 px-2 text-zinc-600">
                  <span className="font-serif">Sub-Total</span>
                  <span className="font-mono font-semibold text-[#1e2536]">
                    Rp {(subtotal || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between py-1 px-2 text-red-600">
                    <span className="font-serif">
                      Tax: PPN ({workspaceBrand?.taxRatePercent || 11}%)
                    </span>
                    <span className="font-mono font-semibold">
                      Rp {taxAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
                {/* GRAND TOTAL ROW */}
                <div className="flex justify-between items-center bg-[#c5a059] text-white font-bold py-2.5 px-4 text-sm mt-2 shadow-sm">
                  <span className="font-serif tracking-wider uppercase">
                    GRAND TOTAL
                  </span>
                  <span className="font-mono text-base">
                    Rp {(grandTotal || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 font-sans leading-relaxed">
              <strong className="text-[#1e2536] block mb-1">PROPOSAL & PITCH TERMS:</strong>
              Investment rates listed above reflect individual unit prices per deliverable or service package. Final scope and total contract value will be computed upon package selection and official invoice issuance. No tax (PPN) is assessed at the pitch stage.
            </div>
          )}

          {/* BOTTOM AREA: Payment Method & Signature Line */}
          <div className="pt-10 border-t border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
            {/* Left: Payment Method & Terms */}
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="text-xs font-serif uppercase tracking-wider font-bold text-[#1e2536] pb-1 border-b border-zinc-300 inline-block">
                  PAYMENT & DISBURSEMENT INSTRUCTIONS
                </h4>
                <div className="mt-2 text-zinc-600 space-y-1">
                  {workspaceBrand?.bankAccounts && workspaceBrand.bankAccounts.length > 0 ? (
                    workspaceBrand.bankAccounts.map((acc, i) => {
                      const rawName = acc.bank_name || 'Bank Account';
                      const cleanName = rawName
                        .replace(/Primary Bank Account/gi, 'Bank Account')
                        .replace(/Secondary Bank Account/gi, 'Bank Account')
                        .replace(/Primary Bank/gi, 'Bank Account')
                        .replace(/Secondary Bank\s*\(\d+\)/gi, 'Bank Account')
                        .replace(/Primary\s+and\s+secondary/gi, 'Bank Account')
                        .replace(/^Primary\s+/gi, '')
                        .replace(/^Secondary\s+/gi, '')
                        .trim() || 'Bank Account';
                      return (
                        <div key={i}>
                          <strong className="text-[#1e2536]">{cleanName}:</strong>{' '}
                          {acc.account_number} <span className="text-zinc-500">({acc.account_name})</span>
                        </div>
                      );
                    })
                  ) : (
                    <div>
                      <strong className="text-[#1e2536]">Bank Transfer:</strong> Please refer to official company instructions upon invoice confirmation.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h5 className="font-serif italic text-[#c5a059] text-sm mb-1">
                  {isQuotation ? 'Looking Forward To Our Collaboration!' : 'Thank You For Your Business!'}
                </h5>
                <div className="text-[11px] text-zinc-500 space-y-1">
                  <div className="font-bold text-zinc-700">Terms & Conditions:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>{isQuotation ? 'Quotation validity period is 15 days from quote date.' : 'Payment is due within 15 days of invoice date.'}</li>
                    <li>
                      {isQuotation ? 'Deliverable timing commences immediately upon contract execution.' : 'Please include Invoice Reference Number on all bank transfer notes.'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right: Signature Line (Thomas removed -> Authorized Officer) */}
            <div className="text-right flex flex-col items-end">
              <div className="font-serif italic text-2xl text-zinc-400 mb-6 pr-4 select-none">
                Authorized Signature
              </div>
              <div className="w-56 border-b-2 border-[#1e2536] pb-1" />
              <div className="mt-2 text-right">
                <div className="font-bold text-[#1e2536] text-xs uppercase tracking-wider">
                  {brandName}
                </div>
                <div className="text-[11px] text-zinc-500">Finance & Executive Department</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print CSS to guarantee true PDF vector layout */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}
