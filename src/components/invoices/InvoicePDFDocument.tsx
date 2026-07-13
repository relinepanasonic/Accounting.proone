'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Download, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { ProfessorTokoOnlineLogo } from '@/components/invoices/ProfessorTokoOnlineLogo';

export interface InvoiceItemData {
  id: string;
  deliveryDate: string;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface InvoiceDocumentProps {
  invoiceNumber: string;
  accountNumber: string;
  invoiceDate: string;
  issueDate: string;
  clientName: string;
  clientContact: string;
  clientAddress: string;
  clientPhone: string;
  items: InvoiceItemData[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
}

export function InvoicePDFDocument({
  invoiceNumber = 'INV-2026-004',
  accountNumber = '#25 212 512',
  invoiceDate = '15 Jul, 2026',
  issueDate = '16 Jul, 2026',
  clientName = 'Richard H. Jonas',
  clientContact = 'Account Manager',
  clientAddress = 'A : 5551 West Street, Ankeny, IA 50023',
  clientPhone = 'P : +1-002/555-0153',
  items = [
    {
      id: '1',
      deliveryDate: '15 Jul, 2026',
      description: 'TikTok Live Commerce Monthly Production Retainer',
      unitPrice: 85000000,
      quantity: 1,
      total: 85000000,
    },
    {
      id: '2',
      deliveryDate: '15 Jul, 2026',
      description: 'Custom HD Video Creator Package (40 Ads Production)',
      unitPrice: 1621750,
      quantity: 40,
      total: 64870000,
    },
  ],
  subtotal = 149870000,
  taxAmount = 16485700,
  grandTotal = 166355700,
}: Partial<InvoiceDocumentProps>) {
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] py-8 px-4 sm:px-8 print:p-0 print:bg-white text-zinc-800">
      {/* Top Controls Strip (Hidden in Print/PDF mode) */}
      <div className="max-w-[850px] mx-auto mb-6 flex items-center justify-between no-print">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-[#d4af37]/30 text-[#f5d77f] hover:bg-[#d4af37]/15 text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO INVOICES</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintPDF}
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4" />
            <span>DOWNLOAD / PRINT PDF INVOICE</span>
          </button>
        </div>
      </div>

      {/* A4/Letter Document Container matching Image 1 exactly */}
      <div className="max-w-[850px] mx-auto bg-white shadow-2xl overflow-hidden print:shadow-none print:max-w-none print:w-full font-sans text-[#2d3748]">
        {/* HEADER SECTION (Dark Navy/Charcoal #1e2536 with Left Gold Accent Strip) */}
        <header className="relative bg-[#1e2536] text-white px-8 sm:px-12 py-9 flex items-center justify-between">
          {/* Vertical Beige/Gold Accent Strip on Far Left Edge */}
          <div className="absolute top-0 left-0 bottom-0 w-3 bg-[#c5a059]" />

          {/* Logo & Branding (Top Left) */}
          <div className="flex items-center gap-4 z-10 pl-2">
            <ProfessorTokoOnlineLogo className="w-14 h-14 shrink-0" />
            <div>
              <h1 className="text-xl font-bold tracking-wider uppercase text-white font-serif">
                PROFESSOR TOKO ONLINE
              </h1>
              <p className="text-[11px] text-[#c5a059] tracking-widest uppercase font-mono mt-0.5">
                EXECUTIVE E-COMMERCE & CREATOR ACCOUNTING
              </p>
            </div>
          </div>

          {/* Contact Info (Top Right) */}
          <div className="text-right text-[11px] leading-relaxed text-zinc-300 font-sans space-y-1 z-10">
            <div className="font-semibold text-white">
              1377 Maxwell Farm Road, Reno, CA 89502
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span>+1-202-555-0199 / +62-811-TOKO-PRO</span>
            </div>
            <div>www.professortokoonline.com</div>
            <div className="text-[#c5a059]">billing@professortokoonline.com</div>
          </div>
        </header>

        {/* Small Gold Block Below Header Edge (matching reference image leftmost margin accent) */}
        <div className="w-3 h-8 bg-[#e2d5ba]" />

        {/* BODY CONTAINER */}
        <div className="px-8 sm:px-12 pt-2 pb-14 space-y-10">
          {/* META SECTION: Bill To (Left) & INVOICE Title + Details (Right) */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
            {/* Left: Bill To */}
            <div className="space-y-1.5 text-xs">
              <span className="text-sm font-serif italic text-[#c5a059] block mb-1">
                Bill To:
              </span>
              <div className="text-base font-bold text-[#1e2536] font-serif">
                {clientName}
              </div>
              <div className="text-zinc-500 font-medium">{clientContact}</div>
              <div className="text-zinc-600 pt-1 leading-relaxed">
                <div>{clientAddress}</div>
                <div>W : www.yourdomain.com</div>
                <div>{clientPhone}</div>
              </div>
            </div>

            {/* Right: INVOICE Title & 3-Column Meta Table */}
            <div className="sm:text-right flex flex-col sm:items-end">
              <h2 className="text-4xl font-serif tracking-[0.25em] text-[#1e2536] font-normal mb-3">
                INVOICE
              </h2>
              <div className="w-full sm:w-80 border-t border-[#1e2536] pt-2 grid grid-cols-3 gap-3 text-center sm:text-left text-[11px]">
                <div>
                  <span className="block text-[10px] text-zinc-400 uppercase font-mono">
                    A/C No
                  </span>
                  <span className="font-bold text-[#1e2536] font-mono">
                    {accountNumber}
                  </span>
                </div>
                <div className="border-l border-zinc-200 pl-3">
                  <span className="block text-[10px] text-zinc-400 uppercase font-mono">
                    Invoice Date
                  </span>
                  <span className="font-semibold text-[#1e2536]">
                    {invoiceDate}
                  </span>
                </div>
                <div className="border-l border-zinc-200 pl-3">
                  <span className="block text-[10px] text-zinc-400 uppercase font-mono">
                    Issue Date
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
                  <th className="py-3 px-2 w-28">D. DATE</th>
                  <th className="py-3 px-2">ITEM DESCRIPTION</th>
                  <th className="py-3 px-2 text-right">UNIT PRICE</th>
                  <th className="py-3 px-2 text-center w-16">QTY</th>
                  <th className="py-3 px-2 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs">
                {items?.map((item, idx) => (
                  <tr key={item.id || idx} className="text-zinc-700">
                    <td className="py-4 px-2 font-mono text-zinc-500">
                      {item.deliveryDate}
                    </td>
                    <td className="py-4 px-2 font-medium text-[#1e2536]">
                      {item.description}
                    </td>
                    <td className="py-4 px-2 text-right font-mono">
                      Rp {item.unitPrice.toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-2 text-center font-mono font-semibold">
                      {item.quantity}
                    </td>
                    <td className="py-4 px-2 text-right font-mono font-bold text-[#1e2536]">
                      Rp {item.total.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CALCULATIONS & FOOTER */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between py-1 px-2 text-zinc-600">
                <span className="font-serif">Sub-Total</span>
                <span className="font-mono font-semibold text-[#1e2536]">
                  Rp {(subtotal || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between py-1 px-2 text-red-600">
                <span className="font-serif">Tax: PPN (11%)</span>
                <span className="font-mono font-semibold">
                  Rp {(taxAmount || 0).toLocaleString('id-ID')}
                </span>
              </div>
              {/* GRAND TOTAL ROW highlighted with Solid Gold Background Block & White Text */}
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

          {/* BOTTOM AREA: Payment Method & Signature Line */}
          <div className="pt-10 border-t border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
            {/* Left: Payment Method & Terms */}
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="text-xs font-serif uppercase tracking-wider font-bold text-[#1e2536] pb-1 border-b border-zinc-300 inline-block">
                  PAYMENT METHOD
                </h4>
                <div className="mt-2 text-zinc-600 space-y-0.5">
                  <div>
                    <strong className="text-[#1e2536]">BCA Virtual Account:</strong>{' '}
                    88019-212-5120 (Professor Toko Online)
                  </div>
                  <div>
                    <strong className="text-[#1e2536]">Bank Mandiri Corporate:</strong>{' '}
                    102-000-988-111
                  </div>
                </div>
              </div>

              <div>
                <h5 className="font-serif italic text-[#c5a059] text-sm mb-1">
                  Thank You For Your Business!
                </h5>
                <div className="text-[11px] text-zinc-500 space-y-1">
                  <div className="font-bold text-zinc-700">Terms & Conditions:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Payment is due within 15 days of invoice date.</li>
                    <li>
                      Please include Invoice Reference Number on all bank transfer notes.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right: Signature Line */}
            <div className="text-right flex flex-col items-end">
              {/* Cursive Digital Signature Placeholder */}
              <div
                className="font-serif italic text-3xl text-[#1e2536] mb-1 pr-4 select-none"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Thomas B. Speicher
              </div>
              <div className="w-56 border-b-2 border-[#1e2536] pb-1" />
              <div className="mt-2 text-right">
                <div className="font-bold text-[#1e2536] text-xs">
                  Thomas B. Speicher
                </div>
                <div className="text-[11px] text-zinc-500">Account Manager</div>
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
