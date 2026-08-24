'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createExpense, updateExpense } from '@/app/actions/expenses';
import { createClientRecord } from '@/app/actions/settings';
import { RupiahInput } from '@/components/ui/RupiahInput';

const CATEGORY_OPTIONS = [
  'Computing Hardware',
  'Studio Equipment & Lighting',
  'Affiliator Agency Payouts',
  'Software & Subscriptions',
  'Office & Utilities',
  'Creator Partnerships & Ads',
];

interface COAAccountMinimal {
  account_code: string;
  account_name: string;
  account_type: string;
}

interface NewExpenseFormProps {
  contacts: any[];
  isHistorical?: boolean;
  coaAccounts?: COAAccountMinimal[];
  initialData?: any;
}

export function NewExpenseForm({ contacts, isHistorical, coaAccounts = [], initialData }: NewExpenseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [localContacts, setLocalContacts] = useState(contacts);
  const vendors = localContacts.filter(c => c.contact_type === 'vendor');
  
  // Extract vendor and notes from description (format: "Vendor Name - Notes" or "Vendor Name")
  const initialDesc = initialData?.description || '';
  const parts = initialDesc.split(' - ');
  const initVendorName = parts[0] || '';
  const initNotes = parts.slice(1).join(' - ') || '';
  
  const existingVendor = initVendorName ? vendors.find(v => (v.company_name || v.name) === initVendorName) : null;
  const [vendorId, setVendorId] = useState(existingVendor?.id || '');
  
  // Quick Add Vendor State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const [category, setCategory] = useState(initialData?.category || CATEGORY_OPTIONS[0]);
  const [dueDate, setDueDate] = useState(() => initialData?.due_date ? initialData.due_date : new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>(initialData?.amount || 1200);
  const [notes, setNotes] = useState(initNotes);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Combobox States
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [searchVendor, setSearchVendor] = useState(existingVendor ? (existingVendor.company_name || existingVendor.name) : '');
  const [coaDropdownOpen, setCoaDropdownOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState(initialData?.category || '');
  const [expandedCoaGroups, setExpandedCoaGroups] = useState<Record<string, boolean>>({});

  const handleQuickAddVendor = async () => {
    if (!quickAddName.trim()) return;
    setIsQuickAdding(true);
    try {
      const res = await createClientRecord({
        name: quickAddName,
        contactType: 'vendor'
      });
      if (res.success && res.client) {
        setLocalContacts(prev => [...prev, { ...res.client, contact_type: 'vendor' }]);
        setVendorId(res.client.id);
        setShowQuickAdd(false);
        setQuickAddName('');
      } else {
        setErrorMsg(res.error || 'Failed to create vendor');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error creating vendor');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setErrorMsg('Please select a vendor or payee name.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Please enter an expense amount greater than Rp 0.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const selectedVendor = localContacts.find(v => v.id === vendorId);
        const finalVendorName = selectedVendor ? (selectedVendor.company_name || selectedVendor.name) : 'Unknown Vendor';
        
        const finalNotes = isHistorical ? `[HISTORICAL_OPENING_BALANCE] ${notes}` : notes;
        const payload = {
          vendor: finalVendorName,
          vendorId,
          category,
          dueDate,
          amount: Number(amount),
          notes: finalNotes,
          isHistorical,
        };
        
        if (initialData?.id) {
          await updateExpense(initialData.id, payload);
        } else {
          await createExpense(payload);
        }
        
        if (isHistorical) {
          router.push('/settings/opening-balances');
        } else {
          router.push('/expenses');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to record expense');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="gold-glass-panel rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex gap-2 items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                Vendor / Payee Name <span className="text-red-500">*</span>
              </label>
              <button 
                type="button" 
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                className="text-[10px] uppercase font-bold text-[#d4af37] hover:text-[#f5d77f] px-2 py-0.5 rounded border border-[#d4af37]/30 bg-[#d4af37]/10"
              >
                + Quick Add
              </button>
            </div>

            {showQuickAdd && (
              <div className="flex gap-2 mb-3 bg-black/40 p-2 rounded-xl border border-zinc-800">
                <input 
                  type="text"
                  placeholder="Vendor Name..."
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#d4af37] focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={isQuickAdding || !quickAddName.trim()}
                  onClick={handleQuickAddVendor}
                  className="bg-[#d4af37] text-black px-3 py-1.5 rounded-lg text-xs font-bold uppercase disabled:opacity-50"
                >
                  {isQuickAdding ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                required
                placeholder="Search vendor..."
                value={searchVendor}
                onChange={(e) => {
                  setSearchVendor(e.target.value);
                  setVendorId('');
                  setVendorDropdownOpen(true);
                }}
                onFocus={() => setVendorDropdownOpen(true)}
                onBlur={() => setTimeout(() => setVendorDropdownOpen(false), 200)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]"
              />
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              {vendorDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.8)] max-h-48 overflow-y-auto">
                  {vendors
                    .filter(v => (v.name + ' ' + (v.company_name || '')).toLowerCase().includes(searchVendor.toLowerCase()))
                    .map(v => (
                      <div
                        key={v.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchVendor(v.company_name || v.name);
                          setVendorId(v.id);
                          setVendorDropdownOpen(false);
                        }}
                        className="px-4 py-2.5 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white cursor-pointer border-b border-zinc-800/50 last:border-0"
                      >
                        {v.name} {v.company_name && v.company_name !== v.name ? `(${v.company_name})` : ''}
                      </div>
                  ))}
                  {vendors.filter(v => (v.name + ' ' + (v.company_name || '')).toLowerCase().includes(searchVendor.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-xs text-zinc-500 italic">No vendors found. Try Quick Add above.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Expense Category
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Search category..."
                value={searchCategory || category}
                onChange={(e) => {
                  setSearchCategory(e.target.value);
                  setCategory('');
                  setCoaDropdownOpen(true);
                }}
                onFocus={() => {
                  setCoaDropdownOpen(true);
                  if (!searchCategory) setSearchCategory(category);
                }}
                onBlur={() => {
                  setTimeout(() => setCoaDropdownOpen(false), 200);
                  if (!category && searchCategory) {
                    // Revert if they didn't select anything valid
                    // Handled loosely here
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-sans pr-10"
              />
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              
              {coaDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] max-h-[300px] overflow-y-auto">
                  {coaAccounts.length > 0 ? (
                    Object.entries(
                      coaAccounts.reduce((acc, curr) => {
                        if (!acc[curr.account_type]) acc[curr.account_type] = [];
                        acc[curr.account_type].push(curr);
                        return acc;
                      }, {} as Record<string, COAAccountMinimal[]>)
                    ).map(([type, accounts]) => {
                      const filtered = accounts.filter(a => 
                        (a.account_code + ' - ' + a.account_name).toLowerCase().includes(searchCategory.toLowerCase())
                      );
                      if (filtered.length === 0) return null;
                      
                      const isExpanded = expandedCoaGroups[type] !== undefined 
                        ? expandedCoaGroups[type] 
                        : (searchCategory.length > 0 ? true : false); // auto-expand if searching, else collapsed

                      return (
                        <div key={type}>
                          <div 
                            className="px-3 py-2 bg-zinc-900 border-y border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider sticky top-0 cursor-pointer flex items-center gap-1.5 hover:text-white transition-colors z-10"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setExpandedCoaGroups(prev => ({
                                ...prev,
                                [type]: !isExpanded
                              }));
                            }}
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            {type}
                          </div>
                          {isExpanded && filtered.map(coa => (
                            <div 
                              key={coa.account_code}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const val = `${coa.account_code} - ${coa.account_name}`;
                                setCategory(val);
                                setSearchCategory(val);
                                setCoaDropdownOpen(false);
                              }}
                              className="px-4 py-2.5 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white cursor-pointer flex items-center gap-2 border-b border-zinc-800/30 last:border-0"
                            >
                              <span className="font-mono text-[#f5d77f] font-bold">{coa.account_code}</span>
                              <span className="truncate">{coa.account_name}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  ) : (
                    // Fallback to CATEGORY_OPTIONS if no COA
                    CATEGORY_OPTIONS.filter(cat => cat.toLowerCase().includes(searchCategory.toLowerCase())).map((cat) => (
                      <div 
                        key={cat}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCategory(cat);
                          setSearchCategory(cat);
                          setCoaDropdownOpen(false);
                        }}
                        className="px-4 py-2.5 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white cursor-pointer border-b border-zinc-800/30 last:border-0"
                      >
                        {cat}
                      </div>
                    ))
                  )}
                  
                  {/* Empty State */}
                  {coaAccounts.length > 0 && Object.values(coaAccounts).filter(a => (a.account_code + ' - ' + a.account_name).toLowerCase().includes(searchCategory.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-xs text-zinc-500 italic">No categories match your search.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Payment Date / Due Date *
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Amount Owed (IDR / Rp) *
            </label>
            <RupiahInput
              required
              placeholder="Rp 0"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
            Memo / Reference Notes
          </label>
          <textarea
            rows={2}
            placeholder="Optional reference note for agency audit trail..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/expenses"
          className="px-5 py-2.5 rounded-full border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 uppercase tracking-wider transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#d4af37] text-zinc-950 font-bold uppercase tracking-wider text-sm hover:bg-[#f5d77f] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          <Check className="w-4 h-4" />
          <span>{isPending ? 'Processing...' : initialData?.id ? 'UPDATE EXPENSE' : 'RECORD EXPENSE'}</span>
        </button>
      </div>
    </form>
  );
}

