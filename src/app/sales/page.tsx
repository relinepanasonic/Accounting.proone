import React from 'react';
import { getSalesDashboardStats } from '@/app/actions/sales';

import { Users, TrendingUp, Target, Briefcase, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

export default async function SalesDashboardPage() {
  const stats = await getSalesDashboardStats();

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Sales Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">Real-time overview of your pipeline and performance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0e0f14] border-[#d4af37]/20 p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Total Pipeline</h3>
            <div className="p-2 bg-[#d4af37]/10 rounded-lg text-[#d4af37]">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-serif text-zinc-100 font-bold">
            {formatCurrency(stats.totalPipelineValue)}
          </div>
          <p className="text-xs text-zinc-500 mt-2">Active deals in pipeline</p>
        </div>

        <div className="bg-[#0e0f14] border-[#d4af37]/20 p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Deals Won (Total)</h3>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-serif text-zinc-100 font-bold">
            {formatCurrency(stats.totalWonValue)}
          </div>
          <p className="text-xs text-zinc-500 mt-2">{stats.wonDealsCount} deals closed successfully</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salesman Report */}
        <div className="bg-[#0e0f14] border-[#d4af37]/20 p-0 rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#d4af37]/10 bg-zinc-900/30 flex items-center gap-3">
            <Users className="w-5 h-5 text-[#d4af37]" />
            <h2 className="text-base font-bold text-zinc-100">Salesman Performance</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {stats.salesmanStats.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">No salesmen data available.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Salesman</th>
                    <th className="px-5 py-3 font-medium text-right">Pipeline</th>
                    <th className="px-5 py-3 font-medium text-right">Won Value</th>
                    <th className="px-5 py-3 font-medium text-center">Won / Lost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {stats.salesmanStats.map((salesman) => (
                    <tr key={salesman.name} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-zinc-200">{salesman.name}</td>
                      <td className="px-5 py-3 text-right text-zinc-400">{formatCurrency(salesman.pipeline)}</td>
                      <td className="px-5 py-3 text-right text-emerald-400 font-medium">{formatCurrency(salesman.wonValue)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-emerald-400">{salesman.wonCount}</span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="text-red-400">{salesman.lostCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Client Report */}
        <div className="bg-[#0e0f14] border-[#d4af37]/20 p-0 rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#d4af37]/10 bg-zinc-900/30 flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-[#d4af37]" />
            <h2 className="text-base font-bold text-zinc-100">Client Deal Breakdown</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {stats.clientStats.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">No client data available.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Client Name</th>
                    <th className="px-5 py-3 font-medium text-right">Active Pipeline</th>
                    <th className="px-5 py-3 font-medium text-right">Total Won</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {stats.clientStats.map((client, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-zinc-200">{client.name}</td>
                      <td className="px-5 py-3 text-right text-[#d4af37]">{formatCurrency(client.pipeline)}</td>
                      <td className="px-5 py-3 text-right text-emerald-400">{formatCurrency(client.won)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
