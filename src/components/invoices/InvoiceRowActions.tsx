'use client';

import React, { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, CheckCircle, Clock, FileText, Trash2, Edit2, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { duplicateInvoice, deleteInvoice, convertQuotationToInvoice, markInvoiceAsFinalized } from '@/app/actions/invoices';
import { InvoicePaymentModal } from './InvoicePaymentModal';

interface InvoiceActionProps {
  id: string;
  status?: string;
  isQuotation?: boolean;
  invoiceNumber?: string;
  totalAmount?: number;
  paidAmount?: number;
  assignedWorkspaceId?: string | null;
  assignedWorkspaceName?: string | null;
}

export function InvoiceStatusToggle({ id, status, invoiceNumber = '', totalAmount = 0, paidAmount = 0, assignedWorkspaceId, assignedWorkspaceName }: InvoiceActionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const isPaid = status?.toLowerCase() === 'paid';
  const isPartial = status?.toLowerCase() === 'partial_paid' || status?.toLowerCase() === 'partial payed' || (paidAmount > 0 && paidAmount < totalAmount);
  const isInvoiced = status?.toLowerCase() === 'invoiced';
  const isDraft = status?.toLowerCase() === 'draft';

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        title="Record Payment"
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase transition-all duration-200 min-w-[80px] ${
          isPaid
            ? 'bg-[#d4af37]/15 border border-[#d4af37]/50 text-[#f5d77f] hover:bg-[#d4af37]/25 shadow-[0_0_12px_rgba(212,175,55,0.25)]'
            : isPartial
            ? 'bg-blue-500/15 border border-blue-500/50 text-blue-400 hover:bg-blue-500/25 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
            : isInvoiced
            ? 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
            : isDraft
            ? 'bg-zinc-800/50 border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
            : 'bg-zinc-900 border border-[#d4af37]/30 text-[#d4af37] hover:border-[#f5d77f]'
        }`}
      >
        {isPaid ? (
          <>
            <CheckCircle className="w-3 h-3 text-[#f5d77f]" />
            <span>PAID</span>
          </>
        ) : isPartial ? (
          <>
            <Clock className="w-3 h-3 text-blue-400" />
            <span>PARTIAL</span>
          </>
        ) : isInvoiced ? (
          <>
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>INVOICED</span>
          </>
        ) : isDraft ? (
          <>
            <Edit2 className="w-3 h-3" />
            <span>DRAFT</span>
          </>
        ) : (
          <>
            <Clock className="w-3 h-3 text-[#d4af37]" />
            <span>PENDING</span>
          </>
        )}
      </button>

      <InvoicePaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        invoiceId={id}
        invoiceNumber={invoiceNumber}
        totalAmount={totalAmount}
        paidAmount={paidAmount}
        assignedWorkspaceId={assignedWorkspaceId}
        assignedWorkspaceName={assignedWorkspaceName}
      />
    </>
  );
}

export function InvoiceActionGroup({ id, isQuotation, status, invoiceNumber }: InvoiceActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<'duplicate' | 'delete' | 'convert' | null>(null);

  const handleDuplicate = () => {
    setActiveAction('duplicate');
    startTransition(async () => {
      try {
        const res = await duplicateInvoice(id);
        if (res?.error) {
          alert(res.error);
        } else if (res?.newInvoiceId) {
          router.push(`/invoices/${res.newInvoiceId}/edit`);
        } else {
          router.refresh();
        }
      } catch (err) {
        console.error(err);
        alert('Failed to duplicate invoice');
      } finally {
        setActiveAction(null);
      }
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to permanently delete this invoice and its line items?')) {
      setActiveAction('delete');
      startTransition(async () => {
        try {
          const res = await deleteInvoice(id);
          if (res?.error) {
            alert(res.error);
          } else {
            router.refresh();
          }
        } catch (err: any) {
          console.error(err);
          alert('Failed to delete invoice');
        } finally {
          setActiveAction(null);
        }
      });
    }
  };

  const handleConvert = () => {
    if (confirm('Convert this Quotation into an Invoice?')) {
      setActiveAction('convert');
      startTransition(async () => {
        try {
          await convertQuotationToInvoice(id);
          router.refresh();
        } catch (err) {
          console.error(err);
        } finally {
          setActiveAction(null);
        }
      });
    }
  };

  const handleFinalize = () => {
    if (confirm('Mark this Invoice as Finalized/Sent and sync to New Wave?')) {
      setActiveAction('convert'); // Reusing 'convert' state for the loader
      startTransition(async () => {
        try {
          const res = await markInvoiceAsFinalized(id);
          if (res?.error) {
            alert(res.error);
          } else {
            router.refresh();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActiveAction(null);
        }
      });
    }
  };

  if (invoiceNumber === 'DIRECT INCOME') {
    return (
      <div className="inline-flex items-center gap-2">
        {/* Direct Income transactions cannot be viewed as PDF or edited via the Invoice editor. */}
        <span className="text-xs text-zinc-600 font-mono italic">
          Quick Income
        </span>
        {/* Delete Invoice Action for Direct Income */}
        <button
          onClick={handleDelete}
          disabled={isPending}
          title="Permanently Delete Income"
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {isQuotation && (
        <button
          onClick={handleConvert}
          disabled={isPending}
          title="Convert to Invoice"
          className="p-1.5 rounded-lg bg-blue-900/20 border border-blue-500/30 hover:border-blue-400 text-blue-400 hover:text-blue-300 hover:scale-105 transition-all duration-200"
        >
          {activeAction === 'convert' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <CheckCircle className="w-3.5 h-3.5" />}
        </button>
      )}

      {status?.toLowerCase() === 'draft' && !isQuotation && (
        <button
          onClick={handleFinalize}
          disabled={isPending}
          title="Mark as Finalized/Sent & Sync to New Wave"
          className="p-1.5 rounded-lg bg-purple-900/20 border border-purple-500/30 hover:border-purple-400 text-purple-400 hover:text-purple-300 hover:scale-105 transition-all duration-200"
        >
          {activeAction === 'convert' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Send className="w-3.5 h-3.5" />}
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
        title={activeAction === 'duplicate' ? 'Processing...' : 'Duplicate Invoice to New Draft'}
        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-[#d4af37]/50 text-zinc-400 hover:text-[#f5d77f] transition-all duration-200"
      >
        {activeAction === 'duplicate' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Delete Invoice Action */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        title={activeAction === 'delete' ? 'Processing...' : 'Permanently Delete Invoice'}
        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
      >
        {activeAction === 'delete' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
