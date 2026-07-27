import React from 'react';
import Link from 'next/link';
import { BookOpen, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AdvancedJournalForm } from '@/components/settings/AdvancedJournalForm';

export const dynamic = 'force-dynamic';

export default function AdvancedOpeningJournalPage() {
  return (
    <div className="space-y-6 max-w-[1000px]">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/opening-balances"
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#d4af37]" />
            Advanced Opening Journal
          </h2>
          <p className="text-[10px] font-mono text-[#d4af37]">STRICT DOUBLE-ENTRY ENFORCEMENT</p>
        </div>
      </div>

      <div className="gold-glass-panel border-[#d4af37]/30 rounded-2xl p-6">
        <div className="flex gap-4 items-start mb-6">
          <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#f5d77f]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Double-Entry Balance Sheet Migration</h3>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              Use this grid to inject historical Assets (Aset), Liabilities (Kewajiban), and Equity (Modal) directly into the general ledger. 
              Common entries include Owner's Capital, Retained Earnings, Fixed Assets (Equipment/Vehicles), and Long-Term Loans.
            </p>
          </div>
        </div>

        <AdvancedJournalForm />
      </div>
    </div>
  );
}
