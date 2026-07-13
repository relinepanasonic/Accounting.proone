'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createExpense } from '@/app/actions/expenses';

const CATEGORY_OPTIONS = [
  'Computing Hardware',
  'Studio Equipment & Lighting',
  'Affiliator Agency Payouts',
  'Software & Subscriptions',
  'Office & Utilities',
  'Creator Partnerships & Ads',
];

export function NewExpenseForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>(1200);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor.trim()) {
      setErrorMsg('Please enter a vendor or payee name.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Please enter an expense amount greater than $0.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        await createExpense({
          vendor,
          category,
          dueDate,
          amount: Number(amount),
          notes,
        });
        router.push('/expenses');
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
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Vendor / Payee Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Adobe Creative Cloud or Sony Professional"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-sans"
            />
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
              Amount Owed (USD) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-zinc-400 font-mono font-bold">$</span>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono font-bold text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
              />
            </div>
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
