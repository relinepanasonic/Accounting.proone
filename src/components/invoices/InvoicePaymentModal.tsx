'use client';

import React, { useState, useTransition } from 'react';
import { X, Check } from 'lucide-react';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { recordInvoicePayment } from '@/app/actions/invoices';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

interface InvoicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  assignedWorkspaceId?: string | null;
  assignedWorkspaceName?: string | null;
}

export function InvoicePaymentModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  totalAmount,
  paidAmount,
  assignedWorkspaceId,
  assignedWorkspaceName,
}: InvoicePaymentModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoTransfer, setAutoTransfer] = useState(true);

  // Only render on client to avoid hydration mismatch with document.body
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const totalAR = totalAmount - paidAmount;

  const handleLunas = () => {
    setPaymentAmount(totalAR);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amountToPay = Number(paymentAmount || 0);
    
    if (amountToPay > totalAR) {
      setErrorMsg('Payment cannot exceed Total A/R');
      return;
    }

    if (amountToPay < 0) {
      setErrorMsg('Payment cannot be negative');
      return;
    }

    startTransition(async () => {
      setErrorMsg(null);
      const today = new Date().toISOString().split('T')[0];
      const res = await recordInvoicePayment(invoiceId, amountToPay, today, 'Manual Payment', autoTransfer && assignedWorkspaceId ? assignedWorkspaceId : undefined);
      if (res.success) {
        onClose();
        router.refresh();
        
        // Generate Receipt PDF
        if (amountToPay > 0) {
          window.open(`/invoices/${invoiceId}?receipt=true`, '_blank');
        }
      } else {
        setErrorMsg(res.error || 'Failed to record payment');
      }
    });
  };



  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md gold-glass-panel rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <h2 className="text-sm font-extrabold tracking-widest uppercase text-white">Payment</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-bold">
              {errorMsg}
            </div>
          )}

          {/* Invoice Summary */}
          <div className="space-y-3 bg-black/40 rounded-xl p-4 border border-zinc-800/50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-mono">INVOICE NO</span>
              <span className="text-white font-bold">{invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-mono">TOTAL AMOUNT</span>
              <span className="text-white font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-mono">PAID AMOUNT</span>
              <span className="text-emerald-400 font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(paidAmount)}</span>
            </div>
            <div className="pt-3 mt-3 border-t border-zinc-800/80 flex justify-between items-center">
              <span className="text-[#d4af37] text-[10px] font-extrabold tracking-widest uppercase">Total A/R (Remaining)</span>
              <span className="text-[#f5d77f] font-mono font-bold text-sm">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalAR)}</span>
            </div>
          </div>

          {/* Payment Input */}
          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Payment Amount</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <RupiahInput
                  value={paymentAmount}
                  onValueChange={setPaymentAmount}
                  className="w-full bg-zinc-900 border border-[#d4af37]/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all font-mono"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={handleLunas}
                className="px-4 py-3 rounded-xl bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f5d77f] font-extrabold text-xs uppercase tracking-wider transition-colors shrink-0"
              >
                Lunas
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 font-sans">
              Enter 0 and save to just mark as sent/invoiced without a payment.
            </p>
          </div>

          {/* Inter-company transfer toggle */}
          {assignedWorkspaceId && assignedWorkspaceId !== '11111111-1111-1111-1111-111111111111' && (
            <div className="pt-2 border-t border-zinc-800/80">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={autoTransfer}
                    onChange={(e) => setAutoTransfer(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 rounded border-2 border-zinc-600 bg-zinc-900 peer-checked:border-[#d4af37] peer-checked:bg-[#d4af37]/20 transition-all flex items-center justify-center">
                    <Check className={`w-3.5 h-3.5 text-[#f5d77f] transition-opacity ${autoTransfer ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-[#f5d77f] transition-colors">
                    Auto-Transfer funds to {assignedWorkspaceName}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                    Creates Expense here & Direct Income in {assignedWorkspaceName}
                  </div>
                </div>
              </label>
            </div>
          )}


          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-800/80 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#f5d77f] text-zinc-950 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isPending ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
