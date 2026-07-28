'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import { BankOpeningBalanceForm } from '@/components/settings/BankOpeningBalanceForm';
import { AdvancedJournalForm } from '@/components/settings/AdvancedJournalForm';
import type { BankAccountItem } from '@/app/actions/settings';

export function OpeningBalancesTab({ bankAccounts = [] }: { bankAccounts?: BankAccountItem[] }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (showAdvanced) {
    return (
      <div className="bg-white/5 backdrop-blur-md border border-yellow-600/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] animate-in fade-in duration-200">
        <div className="flex items-center gap-3 border-b border-yellow-600/20 pb-4">
          <button
            onClick={() => setShowAdvanced(false)}
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#d4af37]" />
              Advanced Opening Journal
            </h2>
            <p className="text-[10px] font-mono text-[#d4af37]">STRICT DOUBLE-ENTRY ENFORCEMENT</p>
          </div>
        </div>
        
        <div className="gold-glass-panel border-[#d4af37]/30 rounded-2xl p-6 mb-6">
          <div className="flex gap-4 items-start">
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
        </div>

        <AdvancedJournalForm />
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-yellow-600/30 rounded-3xl p-6 sm:p-8 space-y-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] animate-in fade-in duration-200">
      <div className="border-b border-yellow-600/20 pb-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
          HISTORICAL OPENING BALANCES (SALDO AWAL)
        </h2>
        <p className="text-xs text-zinc-400 font-sans mt-1">
          Set up your starting balances without inflating current-year revenue or expenses.
        </p>
      </div>

      <div className="space-y-6">
        <div className="gold-glass-panel border-orange-500/30 rounded-2xl p-6">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Historical Migration Engine</h2>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                Use this command center to set up your company's Saldo Awal. These actions create special journal entries that credit 
                <span className="text-[#f5d77f] font-mono mx-1">Retained Earnings / Historical Equity</span> instead of current-year P&L, 
                ensuring your first year in ProOne starts perfectly balanced without artificially inflating revenue or expenses.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Bank Balances */}
          <div className="gold-glass-panel rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">1. Bank & Cash</h3>
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-[9px] font-mono border border-zinc-800">SALDO AWAL KAS</span>
              </div>
              <p className="text-xs text-zinc-400 mb-6">
                Enter the starting balances of your bank accounts on the day before you transitioned to ProOne.
              </p>
              <BankOpeningBalanceForm bankAccounts={bankAccounts} />
            </div>
          </div>

          {/* Historical A/R & A/P */}
          <div className="space-y-6 flex flex-col">
            {/* Piutang */}
            <div className="gold-glass-panel rounded-2xl p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">2. Accounts Receivable</h3>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-[9px] font-mono border border-zinc-800">PIUTANG</span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-4">
                  Log unpaid invoices from your previous system. They will be tracked in A/R but will bypass current-year Revenue.
                </p>
              </div>
              <Link 
                href="/invoices/new?historical=true"
                className="w-full py-2.5 rounded-xl border border-[#d4af37]/30 text-[#f5d77f] text-xs font-bold uppercase tracking-widest text-center hover:bg-[#d4af37]/10 transition-colors flex items-center justify-center gap-2"
              >
                Add Historical Invoice <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Hutang */}
            <div className="gold-glass-panel rounded-2xl p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">3. Accounts Payable</h3>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-[9px] font-mono border border-zinc-800">HUTANG</span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-4">
                  Log unpaid vendor bills from your previous system. They will be tracked in A/P but will bypass current-year Expenses.
                </p>
              </div>
              <Link 
                href="/expenses/new?historical=true"
                className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest text-center hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
              >
                Add Historical Bill <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Advanced Journal Section */}
        <div className="gold-glass-panel border-[#d4af37]/30 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 justify-between items-center">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">4. Advanced Opening Journal</h3>
              <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-[9px] font-mono border border-zinc-800">MODAL & ASET TETAP</span>
            </div>
            <p className="text-xs text-zinc-400 font-sans max-w-xl">
              Need to enter Capital (Modal), Fixed Assets (Peralatan), Bank Loans, Inventory, or Tax Liabilities? 
              Use the Advanced Journal to input your entire Balance Sheet manually. 
              <strong> Total Debits MUST equal Total Credits.</strong>
            </p>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <button 
              onClick={() => setShowAdvanced(true)}
              className="w-full sm:w-auto gold-btn px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Advanced Journal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
