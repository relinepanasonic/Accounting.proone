'use client';

import React, { useTransition } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { toggleExpenseStatus } from '@/app/actions/expenses';

interface ExpenseRowActionsProps {
  id: string;
  status: string;
}

export function ExpenseRowActions({ id, status }: ExpenseRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const isPaid = status.toLowerCase() === 'paid';

  const handleToggle = () => {
    startTransition(async () => {
      try {
        await toggleExpenseStatus(id, status);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
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
  );
}
