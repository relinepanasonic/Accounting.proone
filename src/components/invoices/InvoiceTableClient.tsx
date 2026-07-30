'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { InvoiceStatusToggle, InvoiceActionGroup } from '@/components/invoices/InvoiceRowActions';

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  rawIssueDate: string;
  clientName: string;
  clientContact: string;
  amount: string;
  rawAmount: number;
  dueDate: string;
  rawDueDate: string;
  packageName: string;
  packageQtt: string;
  isQuotation: boolean;
  status: string;
  assignedWorkspaceId: string | null;
  assignedWorkspaceName: string;
}

type SortField = 'invoiceNumber' | 'rawIssueDate' | 'clientName' | 'rawDueDate' | 'packageName' | 'packageQtt' | 'rawAmount' | 'status' | 'assignedWorkspaceName';
type SortOrder = 'asc' | 'desc';

import { updateInvoiceAssignment } from '@/app/actions/invoices';

function InvoiceAssignmentDropdown({ 
  invoiceId, 
  currentAssignedId, 
  availableWorkspaces 
}: { 
  invoiceId: string; 
  currentAssignedId: string | null; 
  availableWorkspaces: any[] 
}) {
  const [isPending, startTransition] = React.useTransition();

  const handleAssignmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAssignedId = e.target.value || null;
    startTransition(async () => {
      try {
        await updateInvoiceAssignment(invoiceId, newAssignedId);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <select
      value={currentAssignedId || ''}
      onChange={handleAssignmentChange}
      disabled={isPending}
      className={`bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none focus:border-[#d4af37] cursor-pointer hover:border-[#d4af37]/50 transition-colors max-w-[120px] ${isPending ? 'opacity-50' : ''}`}
    >
      <option value="">No Assignment</option>
      {availableWorkspaces.filter(w => w.id !== '11111111-1111-1111-1111-111111111111').map(w => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  );
}

export function InvoiceTableClient({ initialInvoices, availableWorkspaces = [] }: { initialInvoices: InvoiceData[], availableWorkspaces?: any[] }) {
  const [filterClient, setFilterClient] = useState('');
  const [filterIssueMonth, setFilterIssueMonth] = useState('');
  const [filterDueMonth, setFilterDueMonth] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const [sortField, setSortField] = useState<SortField>('rawIssueDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-zinc-600 hover:text-zinc-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#d4af37]" /> : <ArrowDown className="w-3 h-3 text-[#d4af37]" />;
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    initialInvoices.forEach(inv => clients.add(inv.clientName));
    return Array.from(clients).sort();
  }, [initialInvoices]);

  const uniqueIssueMonths = useMemo(() => {
    const months = new Set<string>();
    initialInvoices.forEach(inv => {
      if (inv.rawIssueDate) months.add(inv.rawIssueDate.substring(0, 7)); // YYYY-MM
    });
    return Array.from(months).sort().reverse(); // Newest first
  }, [initialInvoices]);

  const uniqueDueMonths = useMemo(() => {
    const months = new Set<string>();
    initialInvoices.forEach(inv => {
      if (inv.rawDueDate) months.add(inv.rawDueDate.substring(0, 7)); // YYYY-MM
    });
    return Array.from(months).sort().reverse(); // Newest first
  }, [initialInvoices]);

  const uniqueAssignments = useMemo(() => {
    const assignments = new Set<string>();
    initialInvoices.forEach(inv => assignments.add(inv.assignedWorkspaceName || 'No Assignment'));
    return Array.from(assignments).sort();
  }, [initialInvoices]);

  const formatMonth = (yyyyMm: string) => {
    if (!yyyyMm) return '';
    const [year, month] = yyyyMm.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const processedInvoices = useMemo(() => {
    let filtered = initialInvoices.filter((inv) => {
      // 1. Hide expired quotations automatically
      if (inv.isQuotation && inv.rawDueDate && inv.rawDueDate < todayStr) {
        return false;
      }

      // 2. Filter by Client Name
      if (filterClient && !inv.clientName.toLowerCase().includes(filterClient.toLowerCase())) {
        return false;
      }

      // 3. Filter by Issue Month (YYYY-MM)
      if (filterIssueMonth && !inv.rawIssueDate.startsWith(filterIssueMonth)) {
        return false;
      }

      // 4. Filter by Due Month (YYYY-MM)
      if (filterDueMonth && !inv.rawDueDate.startsWith(filterDueMonth)) {
        return false;
      }

      // 5. Filter by Assignment
      if (filterAssignment && inv.assignedWorkspaceName !== filterAssignment) {
        return false;
      }

      // 6. Filter by Status
      if (filterStatus !== 'All') {
        if (filterStatus === 'Quotation' && !inv.isQuotation) return false;
        if (filterStatus !== 'Quotation' && inv.isQuotation) return false;
        if (filterStatus !== 'Quotation' && inv.status !== filterStatus.toLowerCase()) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [initialInvoices, filterClient, filterIssueMonth, filterDueMonth, filterAssignment, filterStatus, sortField, sortOrder]);

  return (
    <div className="gold-glass-panel rounded-2xl p-6">
      
      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Search Client</label>
          <select 
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          >
            <option value="">All Clients</option>
            {uniqueClients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Issue Month</label>
          <select 
            value={filterIssueMonth}
            onChange={(e) => setFilterIssueMonth(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          >
            <option value="">All Months</option>
            {uniqueIssueMonths.map(month => (
              <option key={month} value={month}>{formatMonth(month)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Due Month</label>
          <select 
            value={filterDueMonth}
            onChange={(e) => setFilterDueMonth(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          >
            <option value="">All Months</option>
            {uniqueDueMonths.map(month => (
              <option key={month} value={month}>{formatMonth(month)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Assignment</label>
          <select 
            value={filterAssignment}
            onChange={(e) => setFilterAssignment(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          >
            <option value="">All Workspaces</option>
            {uniqueAssignments.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Status</label>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          >
            <option value="All">All</option>
            <option value="Quotation">Quotation</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {processedInvoices.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800/80 rounded-2xl my-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Results Found</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">Try adjusting your filters or create a new entry.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans">
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('invoiceNumber')}>
                  <div className="flex items-center justify-between">No. Invoice {getSortIcon('invoiceNumber')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('rawIssueDate')}>
                  <div className="flex items-center justify-between">Tanggal {getSortIcon('rawIssueDate')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('clientName')}>
                  <div className="flex items-center justify-between">Client {getSortIcon('clientName')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('rawDueDate')}>
                  <div className="flex items-center justify-between">Due Date {getSortIcon('rawDueDate')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('packageName')}>
                  <div className="flex items-center justify-between">Package {getSortIcon('packageName')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('packageQtt')}>
                  <div className="flex items-center justify-between">Qtt {getSortIcon('packageQtt')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('rawAmount')}>
                  <div className="flex items-center justify-end gap-2">Amount Billed {getSortIcon('rawAmount')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('assignedWorkspaceName')}>
                  <div className="flex items-center justify-between">Assignment {getSortIcon('assignedWorkspaceName')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group text-center" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center gap-2">Status {getSortIcon('status')}</div>
                </th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {processedInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`hover:bg-zinc-800/30 transition-colors group ${inv.isQuotation ? 'opacity-75' : ''}`}
                >
                  <td className="py-3 px-3 font-bold text-[#f5d77f]">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#d4af37] rounded-sm"></div>
                      {inv.invoiceNumber}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-zinc-400 font-sans">
                    {inv.issueDate}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-sans font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                      {inv.clientName}
                    </div>
                    {inv.clientContact && <div className="text-[10px] text-zinc-500 font-sans mt-0.5">{inv.clientContact}</div>}
                  </td>
                  <td className="py-3 px-3 text-zinc-400 font-sans">
                    {inv.dueDate}
                  </td>
                  <td className="py-3 px-3 text-zinc-400 font-sans max-w-[200px] truncate" title={inv.packageName}>
                    {inv.packageName}
                  </td>
                  <td className="py-3 px-3 text-zinc-400 font-sans font-medium">
                    {inv.packageQtt}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="text-sm font-extrabold text-[#f5d77f] drop-shadow-[0_0_10px_rgba(245,215,127,0.35)]">
                      {inv.amount}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-zinc-400 font-sans">
                    <InvoiceAssignmentDropdown 
                      invoiceId={inv.id} 
                      currentAssignedId={inv.assignedWorkspaceId} 
                      availableWorkspaces={availableWorkspaces} 
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    {inv.isQuotation ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[10px] tracking-widest uppercase">
                        QUOTE
                      </span>
                    ) : (
                      <InvoiceStatusToggle id={inv.id} status={inv.status} />
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <InvoiceActionGroup id={inv.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
