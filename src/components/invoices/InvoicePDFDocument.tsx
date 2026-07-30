'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Printer, DollarSign, X, Loader2, Check } from 'lucide-react';
import { ProfessorTokoOnlineLogo } from '@/components/invoices/ProfessorTokoOnlineLogo';
import { DescriptionBullets } from '@/components/ui/DescriptionBullets';
import { recordInvoicePayment } from '@/app/actions/invoices';

export interface InvoiceItemData {
  id: string;
  deliveryDate: string;
  packageName?: string | null;
  description: string;
  unitPrice: number;
  quantity: number;
  scale?: string | null;
  discountAmount?: number;
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
  invoiceId?: string;
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
  globalDiscount?: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid?: number;
  payments?: any[];
  workspaceBrand?: WorkspaceBrandInfo;
  documentType?: 'INVOICE' | 'QUOTATION';
}

export function InvoicePDFDocument({
  invoiceId,
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
  globalDiscount = 0,
  taxAmount = 0,
  grandTotal = 0,
  amountPaid = 0,
  payments = [],
  workspaceBrand,
  documentType = 'INVOICE',
}: Partial<InvoiceDocumentProps>) {
  const isQuotation = documentType === 'QUOTATION';
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>(balanceDue || 0);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [isPending, startTransition] = useTransition();

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId || !paymentAmount) return;
    
    startTransition(async () => {
      const res = await recordInvoicePayment(invoiceId, Number(paymentAmount), paymentDate, paymentMethod);
      if (res.success) {
        setShowPaymentModal(false);
      } else {
        alert(res.error);
      }
    });
  };

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
          href="/invoices"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-[#d4af37]/30 text-[#f5d77f] hover:bg-[#d4af37]/15 text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO {isQuotation ? 'QUOTATIONS' : 'INVOICES'}</span>
        </Link>

        <div className="flex items-center gap-3">
          {!isQuotation && invoiceId && balanceDue > 0 && (
            <button
              onClick={() => {
                setPaymentAmount(balanceDue);
                setShowPaymentModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all"
            >
              <DollarSign className="w-4 h-4" />
              <span>RECORD PAYMENT</span>
            </button>
          )}
          <button
            onClick={handlePrintPDF}
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4" />
            <span>DOWNLOAD / PRINT {isQuotation ? 'QUOTATION' : 'INVOICE'} PDF</span>
          </button>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
          <form onSubmit={handleRecordPayment} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white mb-6 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" /> Record Payment
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Amount Paid (Rp)</label>
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* A4/Letter Document Container */}
      <div className="max-w-[850px] mx-auto bg-white shadow-2xl overflow-hidden print:shadow-none print:max-w-none print:w-full font-sans text-[#2d3748]">
        {/* HEADER SECTION (Dark Navy/Charcoal #1e2536 with Left Gold Accent Strip) */}
        <header className="relative bg-[#1e2536] text-white px-8 sm:px-12 py-6 flex items-center justify-between">
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
        <div className="px-8 sm:px-12 pt-2 pb-8 space-y-6">
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
                    {isQuotation ? 'Quote Ref' : 'Invoice No'}
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
                    {isQuotation ? 'Valid Until' : 'Due Date'}
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
                  <th className="py-3 px-2">{isQuotation ? 'DELIVERABLE / SERVICE PITCH' : 'PACKAGE & DESCRIPTION'}</th>
                  <th className="py-3 px-2 text-right">{isQuotation ? 'UNIT INVESTMENT' : 'UNIT PRICE'}</th>
                  {!isQuotation && <th className="py-3 px-2 text-center w-16">QTY</th>}
                  {!isQuotation && <th className="py-3 px-2 text-right">TOTAL</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs">
                {items?.map((item, idx) => (
                  <tr key={item.id || idx} className="text-zinc-700">
                    <td className="py-2.5 px-2 font-medium text-[#1e2536]">
                      {item.packageName && (
                        <div className="font-bold text-[#c5a059] uppercase tracking-wider text-[11px] mb-1">
                          {item.packageName}
                        </div>
                      )}
                      <DescriptionBullets
                        description={item.description}
                        isDark={false}
                        className="text-xs"
                      />
                      {(item.discountAmount ?? 0) > 0 && (
                        <div className="text-[10px] text-red-600 font-mono mt-1">
                          ↳ Discount: -Rp {item.discountAmount!.toLocaleString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold text-[#1e2536]">
                      Rp {item.unitPrice.toLocaleString('id-ID')}
                    </td>
                    {!isQuotation && (
                      <td className="py-2.5 px-2 text-center font-mono font-semibold">
                        {item.quantity} <span className="text-[10px] text-zinc-400 font-sans ml-0.5">{item.scale || 'pc'}</span>
                      </td>
                    )}
                    {!isQuotation && (
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-[#1e2536]">
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
                {globalDiscount > 0 && (
                  <div className="flex justify-between py-1 px-2 text-red-600">
                    <span className="font-serif">Global Discount</span>
                    <span className="font-mono font-semibold">
                      -Rp {globalDiscount.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
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
                
                {/* PAYMENT HISTORY & BALANCE DUE */}
                {payments && payments.length > 0 && (
                  <div className="pt-2 pb-1 border-b border-zinc-200 border-dashed">
                    <span className="font-serif text-zinc-500 uppercase tracking-widest text-[10px]">Payment History</span>
                    {payments.map((p, i) => (
                      <div key={i} className="flex justify-between py-1 px-2 text-zinc-600">
                        <span>Payment {i + 1} <span className="text-[10px] text-zinc-400">({new Date(p.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})</span></span>
                        <span className="font-mono text-[#1e2536]">Rp {Number(p.amount).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {amountPaid > 0 && (
                  <div className="flex justify-between items-center bg-[#1e2536] text-white font-bold py-2.5 px-4 text-sm mt-2 shadow-sm">
                    <span className="font-serif tracking-wider uppercase">
                      BALANCE DUE
                    </span>
                    <span className="font-mono text-base">
                      Rp {balanceDue.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 font-sans leading-relaxed">
              <strong className="text-[#1e2536] block mb-1">PROPOSAL & PITCH TERMS:</strong>
              Investment rates listed above reflect individual unit prices per deliverable or service package. Final scope and total contract value will be computed upon package selection and official invoice issuance. No tax (PPN) is assessed at the pitch stage.
            </div>
          )}

          {/* BOTTOM AREA: Payment Method & Signature Line */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
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
                        .replace(/Primary Bank Account - /gi, '')
                        .replace(/Secondary Bank \(\d+\) - /gi, '')
                        .replace(/Primary Bank Account/gi, '')
                        .replace(/Secondary Bank \(\d+\)/gi, '')
                        .replace(/Secondary Bank Account/gi, '')
                        .trim();
                        
                      return (
                        <div key={i}>
                          {cleanName ? <strong className="text-[#1e2536]">{cleanName}: </strong> : null}
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
            </div>

            {/* Right: Signature Line */}
            <div className="text-right flex flex-col items-end">
              <div className="font-serif italic text-2xl text-zinc-400 mb-3 pr-4 select-none">
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

        {/* PIC 4 STYLE FOOTER */}
        <div className="mt-8 flex h-24 border-t border-zinc-200">
          {/* Dark Left Block */}
          <div className="w-1/3 bg-[#333333] text-white flex flex-col justify-center px-8">
            <div className="text-sm tracking-wide font-sans leading-tight">THANK YOU</div>
            <div className="text-sm tracking-wide font-sans font-bold leading-tight">FOR YOUR BUSINESS</div>
          </div>
          {/* Light Right Block */}
          <div className="w-2/3 bg-white flex flex-col justify-center px-8 text-[10px] text-zinc-700 space-y-1.5 font-sans">
            <div className="font-semibold text-zinc-900 border-b border-zinc-200 pb-1 mb-1">
              On Touch: <span className="font-normal text-zinc-600">{brandAddress || '123 Street Name, Town/City Name, State, County 556'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-900 font-bold">☎</span> {brandPhone || '+999 123 456 789'}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-900 font-bold">✉</span> {brandEmail || 'companyinfo@yourname'}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-900 font-bold">🌍</span> {brandWebsite || 'www.domainname.com'}
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
