'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, CheckCircle, Clock, FileText, Trash2, Edit2 } from 'lucide-react';
import { duplicateInvoice, toggleInvoiceStatus, deleteInvoice, convertQuotationToInvoice } from '@/app/actions/invoices';

interface InvoiceActionProps {
  id: string;
  status?: string;
  isQuotation?: boolean;
}

export function InvoiceStatusToggle({ id, status }: InvoiceActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isPaid = status?.toLowerCase() === 'paid';

  const handleToggleStatus = () => {
    startTransition(async () => {
      try {
        await toggleInvoiceStatus(id, status || 'draft');
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <button
      onClick={handleToggleStatus}
      disabled={isPending}
      title="Toggle Invoice Status"
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase transition-all duration-200 min-w-[80px] ${
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
  );
}

export function InvoiceActionGroup({ id, isQuotation, status }: InvoiceActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDuplicate = () => {
    startTransition(async () => {
      try {
        await duplicateInvoice(id);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to permanently delete this invoice and its line items?')) {
      startTransition(async () => {
        try {
          await deleteInvoice(id);
          router.refresh();
        } catch (err) {
          console.error(err);
        }
      });
    }
  };

  const handleConvert = () => {
    if (confirm('Convert this Quotation into an Invoice?')) {
      startTransition(async () => {
        try {
          await convertQuotationToInvoice(id);
          router.refresh();
        } catch (err) {
          console.error(err);
        }
      });
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      {isQuotation && (
        <button
          onClick={handleConvert}
          disabled={isPending}
          title="Convert to Invoice"
          className="p-1.5 rounded-lg bg-blue-900/20 border border-blue-500/30 hover:border-blue-400 text-blue-400 hover:text-blue-300 hover:scale-105 transition-all duration-200"
        >
          <CheckCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {status?.toLowerCase() === 'paid' && !isQuotation && (
        <Link
          href={`/invoices/${id}?receipt=true`}
          title="Download Payment Receipt"
          className="p-1.5 rounded-lg bg-green-900/20 border border-green-500/30 hover:border-green-400 text-green-400 hover:text-green-300 hover:scale-105 transition-all duration-200"
        >
          <FileText className="w-3.5 h-3.5" />
        </Link>
      )}

      {/* View PDF / Print Invoice Action */}
      <Link
        href={`/invoices/${id}`}
        title={`View / Download PDF ${isQuotation ? 'Quotation' : 'Invoice'}`}
        className="p-1.5 rounded-lg bg-zinc-900 border border-[#d4af37]/30 hover:border-[#d4af37] text-[#f5d77f] hover:scale-105 transition-all duration-200"
      >
        <FileText className="w-3.5 h-3.5" />
      </Link>

      {/* Edit Invoice Action */}
      <Link
        href={`/invoices/${id}/edit`}
        title="Edit Invoice"
        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-[#d4af37] text-zinc-400 hover:text-[#f5d77f] hover:scale-105 transition-all duration-200"
      >
        <Edit2 className="w-3.5 h-3.5" />
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

      {/* Delete Invoice Action */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Permanently Delete Invoice"
        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
