'use client';
import { formatIndoDate } from '@/lib/utils';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { InvoiceStatusToggle, InvoiceActionGroup } from '@/components/invoices/InvoiceRowActions';

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  projectDate: string;
  rawProjectDate: string;
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
  paidAmount: number;
}

type SortField = 'invoiceNumber' | 'rawIssueDate' | 'clientName' | 'rawDueDate' | 'packageName' | 'packageQtt' | 'rawAmount' | 'status' | 'assignedWorkspaceName';
type SortOrder = 'asc' | 'desc';

import { updateInvoiceAssignment, updateInvoiceProjectDate, bulkResyncToNewWave } from '@/app/actions/invoices';

function InvoiceProjectDateDropdown({
  invoiceId,
  currentRawDate,
}: {
  invoiceId: string;
  currentRawDate: string;
}) {
  const [visualDate, setVisualDate] = React.useState(currentRawDate);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setVisualDate(newDate);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(() => {
      // Intentionally not using startTransition to prevent React from 
      // doing any concurrent rendering that might touch the DOM node.
      updateInvoiceProjectDate(invoiceId, newDate).catch(err => {
        console.error('Failed to save date silently:', err);
      });
    }, 800);
  };

  return (
    <div className="relative group inline-flex items-center gap-1 cursor-pointer w-full min-w-[100px] h-full py-1">
      <div className="text-zinc-400 group-hover:text-zinc-200 transition-colors pointer-events-none">
        {visualDate ? (
           <span className="border-b border-dashed border-zinc-700 pb-0.5">{formatIndoDate(visualDate)}</span>
        ) : (
           <span className="border-b border-dashed border-zinc-700 pb-0.5 text-zinc-600 italic">Set date...</span>
        )}
      </div>
      <input
        type="date"
        defaultValue={currentRawDate || ''}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
    </div>
  );
}

function InvoiceAssignmentDropdown({ 
  invoiceId, 
  currentAssignedId, 
  availableWorkspaces,
  activeWorkspaceName
}: { 
  invoiceId: string; 
  currentAssignedId: string | null; 
  availableWorkspaces: any[];
  activeWorkspaceName: string;
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

  const isPT = activeWorkspaceName.toLowerCase().includes('pt') || activeWorkspaceName.toLowerCase().includes('pintu langit');
  const isLocked = !isPT;

  const validOptions = availableWorkspaces.filter(w => w.id !== '11111111-1111-1111-1111-111111111111');
  const displayOptions = isLocked 
    ? validOptions.filter(w => w.name === activeWorkspaceName)
    : validOptions;

  return (
    <select
      value={currentAssignedId || (isLocked && displayOptions.length > 0 ? displayOptions[0].id : '')}
      onChange={handleAssignmentChange}
      disabled={isPending}
      className={`bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none focus:border-[#d4af37] cursor-pointer hover:border-[#d4af37]/50 transition-colors max-w-[120px] ${isPending ? 'opacity-50' : ''}`}
    >
      {!isLocked && <option value="">No Assignment</option>}
      {displayOptions.map(w => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  );
}

export function InvoiceTableClient({ initialInvoices, availableWorkspaces = [], activeWorkspaceName = '' }: { initialInvoices: InvoiceData[], availableWorkspaces?: any[], activeWorkspaceName?: string }) {
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
    return Array.from(months).sort(); // Oldest first (Jan -> Dec)
  }, [initialInvoices]);

  const uniqueDueMonths = useMemo(() => {
    const months = new Set<string>();
    initialInvoices.forEach(inv => {
      if (inv.rawDueDate) months.add(inv.rawDueDate.substring(0, 7)); // YYYY-MM
    });
    return Array.from(months).sort(); // Oldest first (Jan -> Dec)
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

  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{ synced: number; errors: string[] } | null>(null);

  const handleBulkResync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await bulkResyncToNewWave();
      setSyncResult({ synced: res.synced, errors: res.errors });
    } catch (e: any) {
      setSyncResult({ synced: 0, errors: [e?.message || 'Unknown error'] });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="gold-glass-panel rounded-2xl p-6">
      
      {/* Re-sync banner */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkResync}
            disabled={isSyncing}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-wait"
          >
            <svg className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? 'Syncing to New Wave...' : 'Re-sync All → New Wave'}
          </button>
          {syncResult && (
            <span className={`text-xs ${syncResult.errors.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              ✓ {syncResult.synced} synced{syncResult.errors.length > 0 ? ` · ${syncResult.errors.length} errors` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
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
                  <div className="flex items-center justify-between">Tgl Project {getSortIcon('rawIssueDate')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('rawIssueDate')}>
                  <div className="flex items-center justify-between">Tgl Invoice {getSortIcon('rawIssueDate')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('rawDueDate')}>
                  <div className="flex items-center justify-between">Due Date {getSortIcon('rawDueDate')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('clientName')}>
                  <div className="flex items-center justify-between">Client {getSortIcon('clientName')}</div>
                </th>
                <th className="py-3 px-3 cursor-pointer select-none group" onClick={() => handleSort('packageName')}>
                  <div className="flex items-center justify-between">Package {getSortIcon('packageName')}</div>
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
                  {/* No Invoice */}
                  <td className="py-3 px-3 font-bold text-[#f5d77f]">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#d4af37] rounded-sm"></div>
                      {inv.invoiceNumber}
                    </div>
                  </td>
                  {/* Tanggal Project */}
                  <td className={`py-3 px-3 font-sans`}>
                    <InvoiceProjectDateDropdown 
                      invoiceId={inv.id}
                      currentRawDate={inv.rawProjectDate}
                    />
                  </td>
                  {/* Tanggal Invoice */}
                  <td className={`py-3 px-3 font-sans whitespace-nowrap ${inv.isQuotation ? 'text-white' : 'text-zinc-400'}`}>
                    {inv.issueDate}
                  </td>
                  {/* Due Date */}
                  <td className={`py-3 px-3 font-sans whitespace-nowrap ${inv.isQuotation ? 'text-white' : 'text-zinc-400'}`}>
                    {inv.dueDate}
                  </td>
                  {/* Client */}
                  <td className="py-3 px-3">
                    <div className="font-sans font-semibold text-white group-hover:text-[#f5d77f] transition-colors max-w-[150px] truncate">
                      {inv.clientName}
                    </div>
                  </td>
                  {/* Package */}
                  <td className={`py-3 px-3 font-sans max-w-[180px] truncate ${inv.isQuotation ? 'text-white' : 'text-zinc-400'}`} title={`${inv.packageName} — ${inv.packageQtt}`}>
                    <div>{inv.packageName}</div>
                    <div className="text-[10px] text-zinc-500">{inv.packageQtt}</div>
                  </td>
                  {/* Amount Billed */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="text-sm font-extrabold text-[#f5d77f] drop-shadow-[0_0_10px_rgba(245,215,127,0.35)]">
                      {inv.amount}
                    </div>
                    {(inv.paidAmount ?? 0) > 0 && (inv.rawAmount ?? 0) > (inv.paidAmount ?? 0) && (
                      <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                        <span className="text-red-400">-{`Rp ${Math.ceil(inv.paidAmount).toLocaleString('id-ID')}`}</span>
                        <br/>
                        <span className="text-zinc-300">Remaining: {`Rp ${Math.ceil(inv.rawAmount - inv.paidAmount).toLocaleString('id-ID')}`}</span>
                      </div>
                    )}
                  </td>
                  {/* Assignment */}
                  <td className="py-3 px-3 text-zinc-400 font-sans">
                    <InvoiceAssignmentDropdown 
                      invoiceId={inv.id} 
                      currentAssignedId={inv.assignedWorkspaceId} 
                      availableWorkspaces={availableWorkspaces} 
                      activeWorkspaceName={activeWorkspaceName}
                    />
                  </td>
                  {/* Status */}
                  <td className="py-3 px-3 text-center">
                    {inv.isQuotation ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[10px] tracking-widest uppercase">
                        QUOTE
                      </span>
                    ) : (
                      <InvoiceStatusToggle 
                        id={inv.id} 
                        status={inv.status} 
                        invoiceNumber={inv.invoiceNumber}
                        totalAmount={inv.rawAmount}
                        paidAmount={inv.paidAmount}
                        assignedWorkspaceId={inv.assignedWorkspaceId}
                        assignedWorkspaceName={inv.assignedWorkspaceName}
                      />
                    )}
                  </td>
                  {/* Aksi */}
                  <td className="py-3 px-3 text-center">
                    <InvoiceActionGroup id={inv.id} isQuotation={inv.isQuotation} status={inv.status} />
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



