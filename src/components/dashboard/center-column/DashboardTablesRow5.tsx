'use client';

import React from 'react';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import { formatRupiah } from '@/lib/utils';
import { Users, ShoppingCart } from 'lucide-react';

export function DashboardTablesRow5({ telemetry }: { telemetry: DashboardTelemetry }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
      
      {/* Top 10 Clients */}
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Top 10 Clients</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">By Total Revenue Generated</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-3 px-2 text-[10px] font-mono text-zinc-500 uppercase">Rank</th>
                <th className="py-3 px-2 text-[10px] font-mono text-zinc-500 uppercase">Client Name</th>
                <th className="py-3 px-2 text-[10px] font-mono text-zinc-500 uppercase text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.topClients.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-zinc-500 font-mono">NO CLIENT DATA</td>
                </tr>
              ) : (
                telemetry.topClients.map((client, idx) => (
                  <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-2 text-xs font-bold text-[#d4af37]">#{idx + 1}</td>
                    <td className="py-3 px-2 text-xs font-bold text-white uppercase">{client.name}</td>
                    <td className="py-3 px-2 text-xs font-mono text-emerald-400 text-right">{formatRupiah(client.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Products Sold */}
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Top 10 Products Sold</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">By Quantity & Revenue</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-3 px-2 text-[10px] font-mono text-zinc-500 uppercase">Rank</th>
                <th className="py-3 px-2 text-[10px] font-mono text-zinc-500 uppercase">Product / Service</th>
                <th className="py-3 px-2 text-[10px] font-mono text-zinc-500 uppercase text-center">Qty</th>
                <th className="py-3 px-2 text-[10px] font-mono text-zinc-500 uppercase text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-zinc-500 font-mono">NO PRODUCT DATA</td>
                </tr>
              ) : (
                telemetry.topProducts.map((prod, idx) => (
                  <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-2 text-xs font-bold text-[#d4af37]">#{idx + 1}</td>
                    <td className="py-3 px-2 text-xs font-bold text-white uppercase">{prod.name}</td>
                    <td className="py-3 px-2 text-xs font-mono text-zinc-300 text-center">{prod.sold}</td>
                    <td className="py-3 px-2 text-xs font-mono text-emerald-400 text-right">{formatRupiah(prod.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
