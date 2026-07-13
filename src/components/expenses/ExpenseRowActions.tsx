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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase transition-all ${
        isPaid
          ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
          : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
      } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isPaid ? (
        <>
          <CheckCircle className="w-3 h-3" />
          <span>PAID</span>
        </>
      ) : (
        <>
          <Clock className="w-3 h-3" />
          <span>PENDING</span>
        </>
      )}
    </button>
  );
}
