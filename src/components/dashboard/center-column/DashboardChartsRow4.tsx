'use client';

import React from 'react';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine
} from 'recharts';
import { formatRupiah } from '@/lib/utils';
import { Wallet, Gauge } from 'lucide-react';

export function DashboardChartsRow4({ telemetry }: { telemetry: DashboardTelemetry }) {
  const cashData = telemetry.liveCash.labels.map((label, idx) => ({
    name: label,
    Balance: telemetry.liveCash.balance[idx],
  }));

  // BEP ratio (MRR / overhead) per month; the middle of the chart is 1.0, the break-even line.
  const bepSeries = telemetry.cards?.coverage?.series || [];
  const bepLabels = telemetry.cards?.coverage?.labels || [];
  const bepData = bepSeries.map((v, i) => ({ name: bepLabels[i] || String(i + 1), Ratio: Number(v.toFixed(2)) }));
  const bepDev = Math.max(0.5, ...bepSeries.map((v) => Math.abs(v - 1)));

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

      {/* BEP Ratio chart: 1.0 is the middle */}
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">BEP Ratio</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">MRR / Overhead per month. Dashed line = 1.0 (break-even): above earns, below loses</p>
          </div>
        </div>

        <div className="h-64">
          {bepData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-xs text-zinc-500 font-mono">
              Choose All months to see the BEP ratio per month.{telemetry.monthlyCost > 0 ? ` Now: ${telemetry.coverageRatio.toFixed(2)}x` : ''}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bepData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={[1 - bepDev, 1 + bepDev]} tickFormatter={(v) => `${Number(v).toFixed(1)}x`} />
                <ReferenceLine y={1} stroke="#ffffff" strokeOpacity={0.5} strokeDasharray="4 4" label={{ value: '1.0', fill: '#a1a1aa', fontSize: 10, position: 'insideTopRight' }} />
                <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}x`, 'BEP ratio']} contentStyle={{ background: '#0e0f14', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="Ratio" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  );
}
