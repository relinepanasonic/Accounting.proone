'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { X, Check, Trash2, FileText } from 'lucide-react';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { recordInvoicePayment, getInvoicePayments, deleteInvoicePayment } from '@/app/actions/invoices';
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
  const [selectedBankId, setSelectedBankId] = useState<string>('default');

  const [payments, setPayments] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Only render on client to avoid hydration mismatch with document.body
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && invoiceId) {
      setPaymentAmount('');
      setErrorMsg(null);
      setSelectedBankId('default');
      loadHistory();
    }
  }, [isOpen, invoiceId]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    const res = await getInvoicePayments(invoiceId);
    if (res.success) {
      setPayments(res.payments || []);
      setBanks(res.bankAccounts || []);
    }
    setIsLoadingHistory(false);
  };

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
      const bankId = selectedBankId === 'default' ? undefined : selectedBankId;
      
      const res = await recordInvoicePayment(
        invoiceId, 
        amountToPay, 
        today, 
        'Manual Payment', 
        undefined, // reference
        autoTransfer && assignedWorkspaceId ? assignedWorkspaceId : undefined,
        bankId
      );
      
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

  const handleDeletePayment = (txId: string) => {
    if (confirm('Are you sure you want to delete this payment? The ledger will be reversed.')) {
      startTransition(async () => {
        setErrorMsg(null);
        const res = await deleteInvoicePayment(txId, invoiceId);
        if (res.success) {
          await loadHistory();
          router.refresh();
          // We don't onClose() so they can see the updated AR
        } else {
          setErrorMsg(res.error || 'Failed to delete payment');
        }
      });
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg gold-glass-panel rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <h2 className="text-sm font-extrabold tracking-widest uppercase text-white">Payment</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <div className="overflow-y-auto">
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
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
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

              {/* Bank Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Paid To Account (Bank/Cash)</label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all text-sm appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23A1A1AA%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                >
                  <option value="default">Default Account</option>
                  <option value="cash">Cash (Manual)</option>
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bank_name} {bank.account_number ? `- ${bank.account_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inter-company transfer toggle */}
            {assignedWorkspaceId && assignedWorkspaceId !== '11111111-1111-1111-1111-111111111111' && (
              <div className="pt-2 border-t border-zinc-800/80">
                <label className="flex items-center gap-3 cursor-pointer group w-max">
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
                      Auto payment to direct
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
            
            {/* Payment History List */}
            {payments.length > 0 && (
              <div className="pt-6 border-t border-zinc-800/80">
                <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase mb-3">Past Payments</h3>
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 group">
                      <div>
                        <div className="text-xs font-bold text-white mb-0.5">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.amount)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {p.date} • {p.bankName || 'Default Account'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={`/invoices/${invoiceId}?receipt=true`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 hover:text-[#f5d77f] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="View Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete Payment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {isLoadingHistory && payments.length === 0 && (
              <div className="pt-6 border-t border-zinc-800/80 text-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Loading history...</span>
              </div>
            )}
            
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
