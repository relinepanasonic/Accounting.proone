'use client';

import React from 'react';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import { formatRupiah } from '@/lib/utils';
import { Users, ShoppingCart, Store, ListCollapse } from 'lucide-react';

export function DashboardTablesRow5({ telemetry }: { telemetry: DashboardTelemetry }) {
  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      
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

    {/* Under the clients and products: Top 10 Vendors (left) and Top 10 Expenses (right) */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
      <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/10 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Top 10 Vendors</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">By Amount Paid</p>
          </div>
        </div>
        <div className="space-y-3">
          {telemetry.topVendors.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs py-10 font-mono">NO VENDOR PAYMENTS RECORDED</div>
          ) : (
            telemetry.topVendors.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#0b0c10]/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#d4af37] font-bold text-xs w-4 shrink-0">{idx + 1}.</span>
                  <span className="text-zinc-200 text-xs font-bold uppercase truncate">{v.name}</span>
                </div>
                <span className="text-rose-400 font-mono text-xs shrink-0 ml-2">{formatRupiah(v.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
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
        <div className="space-y-3">
          {telemetry.topExpenses.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs py-10 font-mono">NO EXPENSES RECORDED</div>
          ) : (
            telemetry.topExpenses.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#0b0c10]/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#d4af37] font-bold text-xs w-4 shrink-0">{idx + 1}.</span>
                  <span className="text-zinc-200 text-xs font-bold uppercase truncate">{v.name}</span>
                </div>
                <span className="text-rose-400 font-mono text-xs shrink-0 ml-2">{formatRupiah(v.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </>
  );
}
