'use client';

import React from 'react';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { formatRupiah } from '@/lib/utils';
import { TrendingUp, Activity } from 'lucide-react';

export function DashboardChartsRow3({ telemetry }: { telemetry: DashboardTelemetry }) {
  const { labels, revenue, cost } = telemetry.revenueVsCost;
  
  const revCostData = labels.map((label, idx) => ({
    name: label,
    Revenue: revenue[idx],
    Cost: cost[idx],
  }));

  const pnlData = telemetry.pnl.labels.map((label, idx) => ({
    name: label,
    Profit: telemetry.pnl.profit[idx],
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0e0f14] border border-[#d4af37]/30 rounded-xl p-3 shadow-2xl text-xs font-mono">
          <p className="text-zinc-400 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {formatRupiah(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      
      {/* Revenue vs Cost */}
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Revenue vs Cost</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Performance Comparison</p>
          </div>
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revCostData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#52525b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}M`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a', opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
              <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Profit & Loss */}
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Profit & Loss</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Net Income Trend</p>
          </div>
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pnlData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
              <Line 
                type="monotone" 
                dataKey="Profit" 
                stroke="#d4af37" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#0b0c10', stroke: '#d4af37', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#f5d77f' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
