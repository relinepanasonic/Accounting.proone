'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createExpense } from '@/app/actions/expenses';
import { createClientRecord } from '@/app/actions/settings';
import { RupiahInput } from '@/components/ui/RupiahInput';

const CATEGORY_OPTIONS = [
  'Computing Hardware',
  'Studio Equipment & Lighting',
  'Affiliator Agency Payouts',
  'Software & Subscriptions',
  'Office & Utilities',
  'Creator Partnerships & Ads',
];

export interface NewExpenseFormProps {
  isHistorical?: boolean;
  contacts?: Array<{ id: string; name: string; company_name?: string; contact_type?: string }>;
}

export function NewExpenseForm({ isHistorical = false, contacts = [] }: NewExpenseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [localContacts, setLocalContacts] = useState(contacts);
  const vendors = localContacts.filter(c => c.contact_type === 'vendor');
  const [vendorId, setVendorId] = useState('');
  
  // Quick Add Vendor State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>(1200);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleQuickAddVendor = async () => {
    if (!quickAddName.trim()) return;
    setIsQuickAdding(true);
    try {
      const res = await createClientRecord({
        name: quickAddName,
        contactType: 'vendor'
      });
      if (res.success && res.client) {
        setLocalContacts(prev => [...prev, { ...res.client, contact_type: 'vendor' }]);
        setVendorId(res.client.id);
        setShowQuickAdd(false);
        setQuickAddName('');
      } else {
        setErrorMsg(res.error || 'Failed to create vendor');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error creating vendor');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setErrorMsg('Please select a vendor or payee name.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Please enter an expense amount greater than $0.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const selectedVendor = localContacts.find(v => v.id === vendorId);
        const finalVendorName = selectedVendor ? (selectedVendor.company_name || selectedVendor.name) : 'Unknown Vendor';
        
        const finalNotes = isHistorical ? `[HISTORICAL_OPENING_BALANCE] ${notes}` : notes;
        await createExpense({
          vendor: finalVendorName,
          category,
          dueDate,
          amount: Number(amount),
          notes: finalNotes,
          isHistorical,
        });
        
        if (isHistorical) {
          router.push('/settings/opening-balances');
        } else {
          router.push('/expenses');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to record expense');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="gold-glass-panel rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex gap-2 items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                Vendor / Payee Name <span className="text-red-500">*</span>
              </label>
              <button 
                type="button" 
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                className="text-[10px] uppercase font-bold text-[#d4af37] hover:text-[#f5d77f] px-2 py-0.5 rounded border border-[#d4af37]/30 bg-[#d4af37]/10"
              >
                + Quick Add
              </button>
            </div>

            {showQuickAdd && (
              <div className="flex gap-2 mb-3 bg-black/40 p-2 rounded-xl border border-zinc-800">
                <input 
                  type="text"
                  placeholder="Vendor Name..."
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#d4af37] focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={isQuickAdding || !quickAddName.trim()}
                  onClick={handleQuickAddVendor}
                  className="bg-[#d4af37] text-black px-3 py-1.5 rounded-lg text-xs font-bold uppercase disabled:opacity-50"
                >
                  {isQuickAdding ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            )}

            <select
              required
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]"
            >
              <option value="">-- Select Vendor --</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.company_name && v.company_name !== v.name ? `(${v.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Expense Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-sans"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Payment Date / Due Date *
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Amount Owed (IDR / Rp) *
            </label>
            <RupiahInput
              required
              placeholder="Rp 0"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
            Memo / Reference Notes
          </label>
          <textarea
            rows={2}
            placeholder="Optional reference note for agency audit trail..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/expenses"
          className="px-5 py-2.5 rounded-full border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 uppercase tracking-wider transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="gold-btn inline-flex items-center gap-2 px-8 py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>{isPending ? 'RECORDING OUTFLOW...' : 'RECORD EXPENSE'}</span>
        </button>
      </div>
    </form>
  );
}
