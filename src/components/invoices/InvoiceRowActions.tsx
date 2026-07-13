'use client';

import React, { useState, useTransition } from 'react';
import { Copy, RefreshCw, CheckCircle2 } from 'lucide-react';
import { duplicateInvoice, toggleInvoiceStatus } from '@/app/actions/invoices';

interface InvoiceRowActionsProps {
  invoiceId: string;
  currentStatus: string;
}

export function InvoiceRowActions({ invoiceId, currentStatus }: InvoiceRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [justCopied, setJustCopied] = useState(false);

  const handleDuplicate = () => {
    startTransition(async () => {
      try {
        await duplicateInvoice(invoiceId);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } catch (err) {
        console.error('Duplicate failed:', err);
      }
    });
  };

  const handleToggleStatus = () => {
    startTransition(async () => {
      try {
        await toggleInvoiceStatus(invoiceId, currentStatus);
      } catch (err) {
        console.error('Toggle status failed:', err);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Duplicate Button */}
      <button
        onClick={handleDuplicate}
        disabled={isPending}
        title="One-Click Duplicate Invoice (Net 15 Draft)"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 border border-slate-700/80 text-[10px] font-mono transition-colors disabled:opacity-50"
      >
        {justCopied ? (
          <>
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span className="text-cyan-400">COPIED</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            <span>DUPLICATE</span>
          </>
        )}
      </button>

      {/* Toggle Status Button */}
      <button
        onClick={handleToggleStatus}
        disabled={isPending}
        title="Toggle Status (Paid <-> Overdue/Draft)"
        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border border-slate-700/80 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${isPending ? 'animate-spin text-cyan-400' : ''}`} />
      </button>
    </div>
  );
}
