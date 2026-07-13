import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Receipt } from 'lucide-react';
import { NewExpenseForm } from '@/components/expenses/NewExpenseForm';

export const dynamic = 'force-dynamic';

export default function NewExpensePage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses"
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-amber-500/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              <span>RECORD VENDOR EXPENSE OUTFLOW</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              INSTANT A/P LOGGING • COPPER-GOLD HUD ACCENT
            </p>
          </div>
        </div>
      </div>

      <NewExpenseForm />
    </div>
  );
}
