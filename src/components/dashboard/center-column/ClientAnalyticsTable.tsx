'use client';

import React, { useState } from 'react';
import { DashboardTelemetry } from '@/lib/data/dashboard';
import { Users, Filter } from 'lucide-react';

interface ClientAnalyticsTableProps {
  telemetry: DashboardTelemetry;
}

export function ClientAnalyticsTable({ telemetry }: ClientAnalyticsTableProps) {
  const { clientMetrics } = telemetry;
  const [filterMonth, setFilterMonth] = useState('all');

  // Generate unique months from join dates for the filter
  const months = Array.from(new Set(clientMetrics.map(m => {
    // JoinSince is formatted like "02 Sep 2026", let's extract "Sep 2026"
    const parts = m.joinSince.split(' ');
    if (parts.length === 3) return `${parts[1]} ${parts[2]}`;
    return m.joinSince;
  })));

  const filteredClients = filterMonth === 'all' 
    ? clientMetrics 
    : clientMetrics.filter(m => m.joinSince.includes(filterMonth));

  return (
    <div className="gold-glass-panel rounded-2xl p-6 relative overflow-hidden mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#d4af37]" />
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">
            Client Analytics Directory
          </h3>
        </div>
        
        {/* Filter */}
        <div className="flex items-center gap-2 relative">
          <Filter className="w-4 h-4 text-[#d4af37] absolute left-3 pointer-events-none" />
          <select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-[#d4af37]/30 text-xs font-mono text-white focus:outline-none focus:border-[#d4af37] appearance-none"
          >
            <option value="all">All Months</option>
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#d4af37]/20">
              <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Client Name</th>
              <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Join Since</th>
              <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Invoice</th>
              <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Paid</th>
              <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">A/R (Debt)</th>
              <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm font-mono text-zinc-500">
                  No clients found.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-zinc-900/40 transition-colors group">
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-white group-hover:text-[#f5d77f] transition-colors">
                      {client.name}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-mono text-zinc-400">
                      {client.joinSince}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-mono font-bold text-zinc-300">
                      {client.totalInvoices}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-mono text-emerald-400 drop-shadow-md">
                      Rp {client.totalPaid.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-mono ${client.ar > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                      Rp {client.ar.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border 
                      ${client.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                        client.status === 'Debt' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'}`}
                    >
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
