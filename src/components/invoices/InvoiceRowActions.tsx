'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { Copy, CheckCircle, Clock, FileText } from 'lucide-react';
import { duplicateInvoice, toggleInvoiceStatus } from '@/app/actions/invoices';

interface InvoiceRowActionsProps {
  id: string;
  status: string;
}

export function InvoiceRowActions({ id, status }: InvoiceRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const isPaid = status.toLowerCase() === 'paid';

  const handleDuplicate = () => {
    startTransition(async () => {
      try {
        await duplicateInvoice(id);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleToggleStatus = () => {
    startTransition(async () => {
      try {
        await toggleInvoiceStatus(id, status);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      {/* Status Toggle Button in Brushed Gold */}
      <button
        onClick={handleToggleStatus}
        disabled={isPending}
        title="Toggle Invoice Status"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase transition-all duration-200 ${
          isPaid
            ? 'bg-[#d4af37]/15 border border-[#d4af37]/50 text-[#f5d77f] hover:bg-[#d4af37]/25 shadow-[0_0_12px_rgba(212,175,55,0.25)]'
            : 'bg-zinc-900 border border-[#d4af37]/30 text-[#d4af37] hover:border-[#f5d77f]'
        } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isPaid ? (
          <>
            <CheckCircle className="w-3 h-3 text-[#f5d77f]" />
            <span>PAID</span>
          </>
        ) : (
          <>
            <Clock className="w-3 h-3 text-[#d4af37]" />
            <span>PENDING</span>
          </>
        )}
      </button>

      {/* View PDF / Print Invoice Action */}
      <Link
        href={`/invoices/${id}`}
        title="View / Download PDF Invoice"
        className="p-1.5 rounded-lg bg-zinc-900 border border-[#d4af37]/30 hover:border-[#d4af37] text-[#f5d77f] hover:scale-105 transition-all duration-200"
      >
        <FileText className="w-3.5 h-3.5" />
      </Link>

      {/* Duplicate Invoice Action in Brushed Gold */}
      <button
        onClick={handleDuplicate}
        disabled={isPending}
        title="Duplicate Invoice to New Draft"
        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-[#d4af37]/50 text-zinc-400 hover:text-[#f5d77f] transition-all duration-200"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
