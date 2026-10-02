'use client';

import React from 'react';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatRupiah } from '@/lib/utils';
import { Wallet, ListCollapse } from 'lucide-react';

export function DashboardChartsRow4({ telemetry }: { telemetry: DashboardTelemetry }) {
  const cashData = telemetry.liveCash.labels.map((label, idx) => ({
    name: label,
    Balance: telemetry.liveCash.balance[idx],
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0e0f14] border border-[#d4af37]/30 rounded-xl p-3 shadow-2xl text-xs font-mono">
          <p className="text-zinc-400 mb-2">{label}</p>
          <p style={{ color: payload[0].color }} className="font-bold">
            Cash: {formatRupiah(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      
      {/* Live Cash Chart */}
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Live Cash Balance</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Cumulative Cash Flow</p>
          </div>
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#52525b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="Balance" 
                stroke="#06b6d4" 
                fillOpacity={1} 
                fill="url(#colorCash)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Expenses by COA */}
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ListCollapse className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Top 10 Expenses</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">By Chart of Accounts</p>
          </div>
        </div>
        
        <div className="h-64 overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-3">
            {telemetry.topExpenses.length === 0 ? (
              <div className="text-center text-zinc-500 text-xs py-10 font-mono">NO EXPENSES RECORDED</div>
            ) : (
              telemetry.topExpenses.map((exp, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#0b0c10]/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-[#d4af37] font-bold text-xs w-4">{idx + 1}.</span>
                    <span className="text-zinc-200 text-xs font-bold uppercase">{exp.name}</span>
                  </div>
                  <span className="text-rose-400 font-mono text-xs">{formatRupiah(exp.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
