'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Receipt, Search, Filter, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { ExpenseRowActions } from './ExpenseRowActions';
import { formatIndoDate } from '@/lib/utils';

export interface ExpenseRecord {
  id: string;
  date: string;
  vendor: string;
  notes: string;
  category: string;
  amount: number;
  status: string;
}

export function ExpenseClientTable({ initialRecords }: { initialRecords: ExpenseRecord[] }) {
  const [searchPayee, setSearchPayee] = useState('');
  const [searchNotes, setSearchNotes] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [searchCatStr, setSearchCatStr] = useState('');
  const [expandedCatGroups, setExpandedCatGroups] = useState<Record<string, boolean>>({});

  // Extract unique categories and months for dropdowns
  const categories = useMemo(() => Array.from(new Set(initialRecords.map(r => r.category))).sort(), [initialRecords]);
  const INDO_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const formatMonthKey = (yyyyMM: string) => {
    if (!yyyyMM) return '';
    const [y, m] = yyyyMM.split('-');
    return `${INDO_MONTHS[parseInt(m) - 1]} ${y}`;
  };

  const groupedCategories = useMemo(() => {
    const groups: Record<string, string[]> = {};
    categories.forEach(c => {
      let type = 'Operating Expenses'; // Default for unnumbered
      if (c.startsWith('4')) type = 'Income';
      else if (c.startsWith('5') || c.toLowerCase().includes('material')) type = 'Cost of Goods Sold';
      else if (c.startsWith('6') || c.toLowerCase().includes('software')) type = 'Operating Expenses';
      else if (c.startsWith('1')) type = 'Assets';
      else if (c.startsWith('2')) type = 'Liabilities';
      else if (c.startsWith('3')) type = 'Equity';
      else if (c.startsWith('7')) type = 'Other Income';
      else if (c.startsWith('8')) type = 'Other Expense';
      if (!groups[type]) groups[type] = [];
      groups[type].push(c);
    });
    return groups;
  }, [categories]);

  const months = useMemo(() => {
    const m = new Set(initialRecords.map(r => r.date.substring(0, 7))); // YYYY-MM
    return Array.from(m).sort((a, b) => b.localeCompare(a));
  }, [initialRecords]);

  const filteredRecords = useMemo(() => {
    return initialRecords.filter((r) => {
            if (searchPayee && !r.vendor.toLowerCase().includes(searchPayee.toLowerCase())) return false;
      if (searchNotes && !r.notes.toLowerCase().includes(searchNotes.toLowerCase())) return false;
      if (filterMonth && !r.date.startsWith(filterMonth)) return false;
      if (filterCategory && r.category !== filterCategory) return false;
      return true;
    });
  }, [initialRecords, searchPayee, filterMonth, filterCategory]);

  if (initialRecords.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-zinc-800/80 rounded-2xl my-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
          <Receipt className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Expenses Recorded Yet</h3>
          <p className="text-xs text-zinc-400 font-sans mt-1">Record vendor bills, operational overhead, and recurring payables.</p>
        </div>
        <Link
          href="/expenses/new"
          className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105"
        >
          <Plus className="w-4 h-4" /> RECORD FIRST EXPENSE
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] appearance-none"
          >
            <option value="">All Months</option>
            {months.map(m => (
              <option key={m} value={m}>{formatMonthKey(m)}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10 pointer-events-none" />
          <input 
            type="text" 
            placeholder="All Categories" 
            value={searchCatStr || filterCategory}
            onChange={(e) => {
              setSearchCatStr(e.target.value);
              setFilterCategory('');
              setCatDropdownOpen(true);
            }}
            onFocus={() => {
              setCatDropdownOpen(true);
              if (!searchCatStr && filterCategory) setSearchCatStr(filterCategory);
            }}
            onBlur={() => setTimeout(() => setCatDropdownOpen(false), 200)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] truncate"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          
          {catDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] max-h-[300px] overflow-y-auto">
              <div 
                onMouseDown={(e) => { e.preventDefault(); setFilterCategory(''); setSearchCatStr(''); setCatDropdownOpen(false); }}
                className="px-4 py-2.5 text-xs font-bold text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 cursor-pointer border-b border-zinc-800"
              >
                All Categories
              </div>
              
              {Object.entries(groupedCategories).map(([type, cats]) => {
                const filteredCats = cats.filter(c => c.toLowerCase().includes(searchCatStr.toLowerCase()));
                if (filteredCats.length === 0) return null;
                
                const isExpanded = expandedCatGroups[type] !== undefined 
                  ? expandedCatGroups[type] 
                  : (searchCatStr.length > 0 ? true : false);

                return (
                  <div key={type} className="border-b border-zinc-800/50 last:border-0">
                    <div 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setExpandedCatGroups(prev => ({...prev, [type]: !isExpanded}));
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-900/40 hover:bg-zinc-800/60 cursor-pointer sticky top-0 backdrop-blur-md z-10"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3 text-[#d4af37]" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">{type}</span>
                    </div>
                    {isExpanded && (
                      <div className="py-1">
                        {filteredCats.map(c => (
                          <div
                            key={c}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFilterCategory(c);
                              setSearchCatStr(c);
                              setCatDropdownOpen(false);
                            }}
                            className="px-8 py-2 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white cursor-pointer"
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search Payee..." 
            value={searchPayee}
            onChange={(e) => setSearchPayee(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search Notes..." 
            value={searchNotes}
            onChange={(e) => setSearchNotes(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          />
        </div>
      </div>

      {/* Tidy Table */}
      <div className="overflow-x-auto bg-zinc-950/40 rounded-xl border border-zinc-800/60">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans whitespace-nowrap bg-zinc-900/40">
              <th className="py-4 px-4 font-bold">Due Date</th>
              <th className="py-4 px-4 font-bold">Vendor / Payee</th>
              <th className="py-4 px-4 font-bold w-1/3">Notes / Remarks</th>
              <th className="py-4 px-4 font-bold max-w-[200px]">Category</th>
              <th className="py-4 px-4 font-bold text-right">Amount Owed</th>
              <th className="py-4 px-4 font-bold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500 font-sans border-dashed border border-zinc-800/60">
                  No records match your filters.
                </td>
              </tr>
            ) : (
              filteredRecords.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap">
                    {formatIndoDate(item.date)}
                  </td>
                  <td className="py-3.5 px-4 font-sans font-semibold text-zinc-200 group-hover:text-[#f5d77f] transition-colors whitespace-nowrap">
                    <div className="max-w-[150px] sm:max-w-[220px] truncate" title={item.vendor}>
                      {item.vendor}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-sans text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    <div className="truncate whitespace-normal line-clamp-2 max-h-10 leading-tight" title={item.notes}>
                      {item.notes}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500 font-sans whitespace-nowrap">
                    <div className="max-w-[150px] sm:max-w-[200px] truncate" title={item.category}>
                      {item.category}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="text-[13px] font-extrabold text-[#f5d77f]">
                      Rp {item.amount.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <ExpenseRowActions id={item.id} status={item.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-zinc-500 font-mono text-right mt-2">
        SHOWING {filteredRecords.length} OF {initialRecords.length} EXPENSES
      </div>
    </div>
  );
}



