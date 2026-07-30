'use client';

import React from 'react';
import { DashboardTelemetry } from '@/lib/data/dashboard';
import { ArrowDownLeft, ArrowUpRight, Activity } from 'lucide-react';

interface DashboardRow3Props {
  telemetry: DashboardTelemetry;
}

export function DashboardRow3({ telemetry }: DashboardRow3Props) {
  const { accountsPayable, accountsReceivable, netCashFlow } = telemetry;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      
      {/* Accounts Payable (A/P) */}
      <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col justify-between min-h-[140px] relative overflow-hidden">
        <div className="flex items-center justify-between z-10 relative">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-zinc-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Accounts Payable (A/P)
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-600">
            Outflow
          </span>
        </div>
        
        <div className="mt-4 z-10 relative">
          <span className="text-2xl font-black font-mono text-white tracking-tight drop-shadow-md">
            Rp {accountsPayable.toLocaleString('id-ID')}
          </span>
          <p className="text-[10px] font-mono text-zinc-500 mt-1">Pending unpaid bills & expenses</p>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-zinc-600/10 rounded-full blur-2xl"></div>
      </div>

      {/* Accounts Receivable (A/R) */}
      <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col justify-between min-h-[140px] relative overflow-hidden">
        <div className="flex items-center justify-between z-10 relative">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-[#f5d77f]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#f5d77f]">
              Accounts Receivable (A/R)
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#d4af37]/15 text-[#f5d77f] border border-[#d4af37]/40">
            Inflow
          </span>
        </div>
        
        <div className="mt-4 z-10 relative">
          <span className="text-2xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_10px_rgba(245,215,127,0.35)]">
            Rp {accountsReceivable.toLocaleString('id-ID')}
          </span>
          <p className="text-[10px] font-mono text-zinc-400 mt-1">Pending unpaid client invoices</p>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-[#d4af37]/10 rounded-full blur-2xl"></div>
      </div>

      {/* Net Cash Flow */}
      <div className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col justify-between min-h-[140px] relative overflow-hidden bg-gradient-to-br from-[#18233c]/60 to-[#0b0c10]/80">
        <div className="flex items-center justify-between z-10 relative">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#d4af37]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">
              Net Cash Flow (All Time)
            </h3>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${netCashFlow >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
            {netCashFlow >= 0 ? 'Positive' : 'Deficit'}
          </span>
        </div>
        
        <div className="mt-4 z-10 relative">
          <span className={`text-2xl font-black font-mono tracking-tight drop-shadow-md ${netCashFlow >= 0 ? 'text-[#f5d77f]' : 'text-rose-400'}`}>
            {netCashFlow >= 0 ? '+' : '-'}Rp {Math.abs(netCashFlow).toLocaleString('id-ID')}
          </span>
          <p className="text-[10px] font-mono text-zinc-400 mt-1">Total Paid Invoices - Paid Expenses</p>
        </div>

        {/* Ambient Glow */}
        <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl ${netCashFlow >= 0 ? 'bg-[#f5d77f]/10' : 'bg-rose-500/10'}`}></div>
      </div>

    </div>
  );
}
