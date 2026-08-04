'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Clock, Trash2 } from 'lucide-react';
import { toggleExpenseStatus, deleteExpense } from '@/app/actions/expenses';

interface ExpenseRowActionsProps {
  id: string;
  status: string;
}

export function ExpenseRowActions({ id, status }: ExpenseRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isPaid = status.toLowerCase() === 'paid';

  const handleToggle = () => {
    startTransition(async () => {
      try {
        await toggleExpenseStatus(id, status);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to permanently delete this expense?')) {
      startTransition(async () => {
        try {
          await deleteExpense(id);
          router.refresh(); // Ensure Client Component state forces a refresh to remove the item instantly
        } catch (err) {
          console.error(err);
        }
      });
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase transition-all duration-200 ${
          isPaid
            ? 'bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#f5d77f] hover:bg-[#d4af37]/25 shadow-[0_0_12px_rgba(212,175,55,0.25)]'
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
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Delete Expense"
        className="p-1.5 rounded-lg bg-red-900/20 border border-red-500/30 hover:border-red-400 text-red-400 hover:text-red-300 hover:scale-105 transition-all duration-200"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
