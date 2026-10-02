'use client';

import React from 'react';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import { formatRupiah } from '@/lib/utils';
import { Package, Briefcase, Users, Wallet, Clock } from 'lucide-react';

export function DashboardBottomNumbers({ telemetry }: { telemetry: DashboardTelemetry }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      
      {/* Total COGS */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group">
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 group-hover:bg-red-500/20 transition-colors">
            <Package className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-red-300">Total COGS</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.totalCogs)}</div>
          <div className="text-xs text-red-500/50 font-mono mt-1">Cost of Goods Sold</div>
        </div>
      </div>

      {/* Total Cost */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group">
        <div className="flex items-center gap-3 text-rose-400 mb-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">
            <Briefcase className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-rose-300">Total Cost</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.totalCost)}</div>
          <div className="text-xs text-rose-500/50 font-mono mt-1">All Expenses</div>
        </div>
      </div>

      {/* Total Salary */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group">
        <div className="flex items-center gap-3 text-cyan-400 mb-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-cyan-300">Total Salary</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.totalSalary)}</div>
          <div className="text-xs text-cyan-500/50 font-mono mt-1">Payroll & Wages</div>
        </div>
      </div>

      {/* Total Cash Flow */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group border-[#d4af37]/20 hover:border-[#d4af37]/50">
        <div className="flex items-center gap-3 text-[#f5d77f] mb-3">
          <div className="p-2 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/30 group-hover:bg-[#d4af37]/30 transition-colors">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#f5d77f]">Total Cash</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.totalCashFlow)}</div>
          <div className="text-xs text-[#d4af37]/60 font-mono mt-1">Cash In - Cash Out</div>
        </div>
      </div>

      {/* Total A/R */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group border-amber-500/20">
        <div className="flex items-center gap-3 text-amber-500 mb-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-amber-400">Total A/R</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.totalAR)}</div>
          <div className="text-xs text-amber-500/50 font-mono mt-1">Accounts Receivable</div>
        </div>
      </div>

    </div>
  );
}
