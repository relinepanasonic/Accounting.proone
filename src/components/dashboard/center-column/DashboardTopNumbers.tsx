'use client';

import React from 'react';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import { formatRupiah } from '@/lib/utils';
import { Target, TrendingUp, BarChart3, Receipt, Users } from 'lucide-react';

export function DashboardTopNumbers({ telemetry }: { telemetry: DashboardTelemetry }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      
      {/* Total Revenue */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group">
        <div className="flex items-center gap-3 text-[#d4af37] mb-3">
          <div className="p-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 group-hover:bg-[#d4af37]/20 transition-colors">
            <Target className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase">Total Revenue</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.totalRevenue)}</div>
          <div className="text-xs text-zinc-500 font-mono mt-1">Billed amount</div>
        </div>
      </div>

      {/* Paid Revenue */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group border-[#10b981]/20 hover:border-[#10b981]/40">
        <div className="flex items-center gap-3 text-emerald-500 mb-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-emerald-400">Paid Revenue</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.paidRevenue)}</div>
          <div className="text-xs text-emerald-500/50 font-mono mt-1">Collected</div>
        </div>
      </div>

      {/* AVG Monthly Revenue */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group">
        <div className="flex items-center gap-3 text-blue-400 mb-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-blue-300">AVG Monthly</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.avgMonthlyRevenue)}</div>
          <div className="text-xs text-blue-500/50 font-mono mt-1">Per active month</div>
        </div>
      </div>

      {/* AOV */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group">
        <div className="flex items-center gap-3 text-purple-400 mb-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
            <Receipt className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-purple-300">AVG Order Value</span>
        </div>
        <div>
          <div className="text-xl font-bold font-serif text-white">{formatRupiah(telemetry.avgOrderValue)}</div>
          <div className="text-xs text-purple-500/50 font-mono mt-1">Per invoice</div>
        </div>
      </div>

      {/* Active & New Client */}
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col justify-between group">
        <div className="flex items-center gap-3 text-orange-400 mb-3">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 group-hover:bg-orange-500/20 transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-orange-300">Clients</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold font-serif text-white">{telemetry.activeClientCount}</div>
            <div className="text-[10px] text-orange-500/50 font-mono mt-1 uppercase tracking-wider">Active</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-serif text-white">+{telemetry.newClientCount}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">New</div>
          </div>
        </div>
      </div>

    </div>
  );
}
