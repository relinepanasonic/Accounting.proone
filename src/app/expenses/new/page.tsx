import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Receipt } from 'lucide-react';
import { NewExpenseForm } from '@/components/expenses/NewExpenseForm';

export const dynamic = 'force-dynamic';

export default function NewExpensePage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#d4af37]" />
              <span>RECORD VENDOR EXPENSE OUTFLOW • LUXURY GOLD HUD</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              INSTANT A/P LOGGING • BRUSHED GOLD ACCENT
            </p>
          </div>
        </div>
      </div>

      <NewExpenseForm />
    </div>
  );
}
