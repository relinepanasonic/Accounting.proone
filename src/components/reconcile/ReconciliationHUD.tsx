'use client';

import React, { useState, useTransition } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { reconcileRecord, quickResolveAndReconcile } from '@/app/actions/reconcile';
import { createClientRecord } from '@/app/actions/settings';
import { RupiahInput } from '@/components/ui/RupiahInput';

export interface UnreconciledSystemRecord {
  id: string;
  type: 'invoice' | 'expense' | 'payroll' | 'income';
  reference: string;
  payeeOrClient: string;
  date: string;
  amount: number;
  reconciled?: boolean;
  notes?: string;
}

interface BankLine {
  id: string;
  date: string;
  sourceDestination: string;
  transactionDetails: string;
  notes: string;
  rekFrom: string;
  amount: number;
}

const SAMPLE_BANK_STATEMENT: BankLine[] = [
  { id: 'bank-001', date: '2026-07-02', sourceDestination: 'TRANSFER INVOICE INV-2026-001 PROF TOKO ONLINE', transactionDetails: '', notes: '', rekFrom: '', amount: 149870000 },
  { id: 'bank-002', date: '2026-07-07', sourceDestination: 'ACH DEBIT CLOUD SERVER HOSTING A/P', transactionDetails: '', notes: '', rekFrom: '', amount: -18000000 },
  { id: 'bank-003', date: '2026-07-10', sourceDestination: 'WIRE OUTWARD STUDIO RENT POWER UTILITIES', transactionDetails: '', notes: '', rekFrom: '', amount: -64500000 },
];

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder?: string;
}

interface COAAccountMinimal {
  account_code: string;
  account_name: string;
  account_type: string;
}

interface ReconciliationHUDProps {
  systemRecords: UnreconciledSystemRecord[];
  bankAccounts?: BankAccount[];
  coaAccounts?: COAAccountMinimal[];
  reconciledBankRefs?: string[];
  vendors?: { id: string; name: string }[];
}

export function ReconciliationHUD({ systemRecords, bankAccounts = [], coaAccounts = [], reconciledBankRefs = [], vendors = [] }: ReconciliationHUDProps) {
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [recordsList, setRecordsList] = useState<UnreconciledSystemRecord[]>(systemRecords);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Resolution Widget State
  const [resolutionTab, setResolutionTab] = useState<'expense' | 'income' | 'manual'>('expense');
  const [quickCategory, setQuickCategory] = useState<string>('');
  const [quickVendorName, setQuickVendorName] = useState('');
  const [quickVendorId, setQuickVendorId] = useState<string | undefined>(undefined);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [isQuickAddingVendor, setIsQuickAddingVendor] = useState(false);
  const [localVendors, setLocalVendors] = useState(vendors);
  
  const [quickDate, setQuickDate] = useState('');
  const [quickAmount, setQuickAmount] = useState<number | ''>('');
  const [quickNotes, setQuickNotes] = useState('');
  const [coaDropdownOpen, setCoaDropdownOpen] = useState(false);
  const [expandedCoaGroups, setExpandedCoaGroups] = useState<Record<string, boolean>>({});
  
  const [activeBankId, setActiveBankId] = useState<string>(bankAccounts.length > 0 ? bankAccounts[0].id : '');
  const [bankFormat, setBankFormat] = useState<string>('jago');
  
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [filterMonth, setFilterMonth] = useState<number>(currentMonth);
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [showReconciled, setShowReconciled] = useState(false);

  const activeBankLine = bankLines.find((b) => b.id === selectedBankId);
  const autoMatchRecord = activeBankLine ? findAutoMatch(activeBankLine) : null;
  const currentTargetRecordIds = selectedRecordIds.length > 0 ? selectedRecordIds : (autoMatchRecord ? [autoMatchRecord.id] : []);

  React.useEffect(() => {
    if (activeBankLine) {
      setQuickVendorName(activeBankLine.sourceDestination || '');
      setQuickVendorId(undefined); // Reset ID so it acts as free text unless explicitly matched/selected
      setQuickDate(activeBankLine.date || '');
      setQuickAmount(Math.abs(activeBankLine.amount || 0));
      setQuickNotes([activeBankLine.notes, activeBankLine.transactionDetails].filter(Boolean).join(' | '));
      
      // Default to manual match so user sees system records
      setResolutionTab('manual');
    }
  }, [activeBankLine]);

  function findAutoMatch(bankLine: BankLine) {
    return recordsList.find(
      (r) =>
        !r.reconciled &&
        Math.abs(r.amount - Math.abs(bankLine.amount)) < 0.01 &&
        ((bankLine.amount > 0 && (r.type === 'invoice' || r.type === 'income')) ||
          (bankLine.amount < 0 && (r.type === 'expense' || r.type === 'payroll')))
    );
  }

  const filteredBankLines = React.useMemo(() => {
    return bankLines.filter((b) => {
      const d = new Date(b.date);
      const matchesMonth = (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
      if (!matchesMonth) return false;
      
      const autoMatch = findAutoMatch(b);
      if (activeFilterTab === 'matched') return !!autoMatch;
      if (activeFilterTab === 'unmatched') return !autoMatch;
      return true;
    });
  }, [bankLines, filterMonth, filterYear, activeFilterTab, recordsList]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      startTransition(async () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bankFormat', bankFormat);
        try {
          const res = await fetch('/api/v1/reconcile/parse-pdf', {
            method: 'POST',
            body: formData,
          });
          const result = await res.json();
          if (result.success && result.data && result.data.length > 0) {
            // Filter out items already reconciled
            let filteredData = result.data.filter((line: BankLine) => {
              const uniqueRef = `BANK-REF:${line.date}:${line.amount}:${line.sourceDestination}`;
              const fallbackRef = `BANK-REF: ${line.sourceDestination}`;
              return !reconciledBankRefs.includes(uniqueRef) && !reconciledBankRefs.includes(fallbackRef);
            });

            if (filteredData.length === 0) {
              alert('All items in this statement have already been reconciled and filtered out!');
              return;
            }

            const sortedData = filteredData.sort((a: BankLine, b: BankLine) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            if (sortedData.length > 0) {
              const firstDate = new Date(sortedData[0].date);
              setFilterMonth(firstDate.getMonth() + 1);
              setFilterYear(firstDate.getFullYear());
            }
            
            setBankLines(sortedData);
            setSelectedBankId(sortedData[0].id);
          } else {
            alert(result.error || 'No transactions found in this PDF. Please ensure it is a valid Bank Jago statement.');
            console.error('PDF Parse Error Details:', result);
          }
        } catch (err: any) {
          alert('Network or Server Error: ' + err.message);
          console.error('PDF Parse Error:', err);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        const parsed: BankLine[] = [];

        lines.slice(1).forEach((line, idx) => {
          const cols = line.split(',');
          if (cols.length >= 3) {
            const amt = parseFloat(cols[2].trim());
            if (!isNaN(amt)) {
              parsed.push({
                id: `csv-${idx}`,
                date: cols[0].trim(),
                sourceDestination: cols[1].trim(),
                transactionDetails: '',
                notes: '',
                rekFrom: '',
                amount: amt,
              });
            }
          }
        });

        if (parsed.length > 0) {
          let filteredParsed = parsed.filter((line) => {
            const uniqueRef = `BANK-REF:${line.date}:${line.amount}:${line.sourceDestination}`;
            const fallbackRef = `BANK-REF: ${line.sourceDestination}`;
            return !reconciledBankRefs.includes(uniqueRef) && !reconciledBankRefs.includes(fallbackRef);
          });

          if (filteredParsed.length === 0) {
            alert('All items in this statement have already been reconciled and filtered out!');
            return;
          }

          if (filteredParsed.length > 0) {
            const firstDate = new Date(filteredParsed[0].date);
            if (!isNaN(firstDate.getTime())) {
              setFilterMonth(firstDate.getMonth() + 1);
              setFilterYear(firstDate.getFullYear());
            }
          }

          const sortedParsed = filteredParsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setBankLines(sortedParsed);
          setSelectedBankId(sortedParsed[0].id);
        }
      };
      reader.readAsText(file);
    }
  };


  const handleMatchAndClear = (overrideTargetId?: string) => {
    const activeTargetIds = typeof overrideTargetId === 'string' ? [overrideTargetId] : currentTargetRecordIds;
    if (!activeBankLine || activeTargetIds.length === 0) return;
    const targetRecords = recordsList.filter((r) => activeTargetIds.includes(r.id));
    if (targetRecords.length === 0) return;

    startTransition(async () => {
      try {
        const bankAmountAbs = Math.abs(activeBankLine.amount);
        const recordAmountAbs = Math.abs(targetRecords.reduce((sum, r) => sum + Math.abs(r.amount), 0));
        
        let shouldClearDiff = false;
        let isPartialPayment = false;
        if (bankAmountAbs !== recordAmountAbs) {
          if (targetRecords.length > 1) {
            alert(`Amount mismatch!\nBank: ${bankAmountAbs}\nSystem: ${recordAmountAbs}\n\nYou cannot auto-adjust multiple records. Please manually adjust the system records to match the bank statement.`);
            return;
          }
          if (bankAmountAbs < recordAmountAbs && targetRecords[0].type === 'invoice') {
            const proceed = confirm(`Partial payment detected!\nBank: ${bankAmountAbs}\nSystem: ${recordAmountAbs}\n\nWould you like to record this as a PARTIAL PAYMENT instead of shrinking the invoice?`);
            if (proceed) {
              isPartialPayment = true;
            } else {
              const proceedAdjust = confirm(`Do you want to permanently shrink the invoice amount to match the bank statement and continue?`);
              if (!proceedAdjust) return;
              shouldClearDiff = true;
            }
          } else {
            const proceed = confirm(`Amount mismatch!\nBank: ${bankAmountAbs}\nSystem: ${recordAmountAbs}\n\nDo you want to adjust the system record to match the bank statement and continue?`);
            if (!proceed) return;
            shouldClearDiff = true;
          }
        }

        const uniqueRef = `BANK-REF:${activeBankLine.date}:${activeBankLine.amount}:${activeBankLine.sourceDestination}`;
        
        for (const targetRecord of targetRecords) {
          await reconcileRecord(
            targetRecord.id, 
            targetRecord.type, 
            uniqueRef, 
            activeBankId, 
            (shouldClearDiff || isPartialPayment) ? activeBankLine.amount : undefined,
            isPartialPayment
          );
        }

        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        if (isPartialPayment) {
          setRecordsList((prev) => prev.map((r) => {
            if (activeTargetIds.includes(r.id)) {
              return { ...r, amount: r.amount > 0 ? r.amount - bankAmountAbs : r.amount + bankAmountAbs };
            }
            return r;
          }));
        } else {
          setRecordsList((prev) => prev.filter((r) => !activeTargetIds.includes(r.id)));
        }
        setSelectedRecordIds([]);
        setSelectedBankId(null);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleQuickResolve = () => {
    if (!activeBankLine) return;
    startTransition(async () => {
      try {
        const uniqueBankRef = `BANK-REF:${activeBankLine.date}:${activeBankLine.amount}:${activeBankLine.sourceDestination}`;
        // Combine vendor + notes for description since DB doesn't have notes column
        const finalDescription = (quickVendorName ? quickVendorName + ' | ' : '') + quickNotes;

        await quickResolveAndReconcile(
          resolutionTab === 'expense' ? 'expense' : 'income',
          quickCategory,
          Number(quickAmount) || Math.abs(activeBankLine.amount),
          quickDate || activeBankLine.date,
          finalDescription || 'Quick Resolve',
          uniqueBankRef,
          activeBankId,
          quickVendorId
        );
        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        setSelectedBankId(null);
        
        // Reset quick form fields so they don't stick for the next item
        setQuickCategory('');
        setQuickVendorName('');
        setQuickVendorId(undefined);
        setQuickNotes('');
      } catch (err) {
        console.error(err);
        alert('Failed to save quick record. Please try again.');
      }
    });
  };

  const handleQuickAddVendor = async () => {
    if (!quickVendorName.trim()) return;
    setIsQuickAddingVendor(true);
    try {
      const res = await createClientRecord({
        name: quickVendorName,
        contactType: 'vendor'
      });
      if (res.success && res.client) {
        setLocalVendors(prev => [...prev, res.client!]);
        setQuickVendorId(res.client.id);
        setVendorDropdownOpen(false);
      } else {
        alert(res.error || 'Failed to create vendor');
      }
    } catch (err: any) {
      alert(err?.message || 'Error creating vendor');
    } finally {
      setIsQuickAddingVendor(false);
    }
  };

  const renderSystemRecordsList = () => {
    let filteredRecords = recordsList.filter((r) => {
      if (!showReconciled && r.reconciled) return false;
      
      // Bypass month filter if user is actively trying to match a selected bank line
      if (activeBankLine) return true;
      
      const d = new Date(r.date);
      return (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
    });
    
    if (activeBankLine) {
      filteredRecords = filteredRecords.filter((rec) => {
        if (activeBankLine.amount > 0) {
          return rec.type === 'invoice' || rec.type === 'income';
        } else {
          return rec.type === 'expense' || rec.type === 'payroll';
        }
      });
      filteredRecords = filteredRecords.sort((a, b) => {
        const aAuto = autoMatchRecord?.id === a.id;
        const bAuto = autoMatchRecord?.id === b.id;
        if (aAuto && !bAuto) return -1;
        if (!aAuto && bAuto) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    } else {
      filteredRecords = filteredRecords.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    const items = [
      <div key="toggle" className="flex items-center gap-2 mb-2 px-1">
        <input 
          type="checkbox" 
          id="showReconciledToggle" 
          checked={showReconciled}
          onChange={(e) => setShowReconciled(e.target.checked)}
          className="accent-[#d4af37]"
        />
        <label htmlFor="showReconciledToggle" className="text-xs font-bold text-zinc-400 cursor-pointer hover:text-white transition-colors">
          Show already-reconciled records (e.g. manually cleared)
        </label>
      </div>
    ];

    if (filteredRecords.length === 0) {
      items.push(
        <div key="empty" className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
          <div className="text-white font-bold">NO UNRECONCILED SYSTEM RECORDS</div>
          <div className="text-[10px] text-zinc-400 font-sans">
            {activeBankLine ? `No ${activeBankLine.amount > 0 ? 'income/invoices' : 'expense/payroll'} available to match.` : 'All invoices and expenses are cleared or none have been issued yet.'}
          </div>
        </div>
      );
      return items;
    }

    items.push(...filteredRecords.map((rec) => {
      const isHighlighted = currentTargetRecordIds.includes(rec.id);
      const isAuto = autoMatchRecord?.id === rec.id;

      return (
        <div
          key={rec.id}
          onClick={() => setSelectedRecordIds(prev => prev.includes(rec.id) ? prev.filter(id => id !== rec.id) : [...prev, rec.id])}
          className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
            isHighlighted
              ? 'bg-[#d4af37]/20 border-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
              : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">{rec.date}</span>
            <span className={`font-bold ${rec.amount > 0 ? 'text-[#f5d77f]' : 'text-red-400'}`}>
              {rec.amount > 0 ? `+Rp ${rec.amount.toLocaleString('en-US')}` : `-Rp ${Math.abs(rec.amount).toLocaleString('en-US')}`}
            </span>
          </div>
          <div className="text-xs font-sans text-white font-medium flex items-center justify-between">
            <span>{rec.payeeOrClient || rec.reference}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-[#d4af37] uppercase border border-[#d4af37]/20">
              {rec.type}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono font-normal tracking-wider mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="truncate pr-2">{rec.notes || 'NO NOTES'}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {rec.reconciled && (
                 <span className="text-emerald-500 font-bold bg-emerald-500/10 px-1 rounded">ALREADY RECONCILED</span>
              )}
              {isAuto && (
                 <span className="text-[#f5d77f] font-bold bg-[#d4af37]/10 px-1 rounded">RECOMMENDED MATCH</span>
              )}
              {activeBankLine && !rec.reconciled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRecordIds([rec.id]);
                    handleMatchAndClear(rec.id);
                  }}
                  className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-extrabold px-3 py-1.5 rounded transition-colors text-[10px]"
                >
                  {isPending ? '...' : 'MATCH'}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }));

    return items;
  };

  return (
    <div className="space-y-6">
      {/* Upload & Demo Strip */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8 p-6 gold-glass-panel rounded-2xl border border-[#d4af37]/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#8a7322] p-0.5 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <div className="w-full h-full bg-black/80 rounded-[10px] flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-[#d4af37]" />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider mb-1">
              BANK RECONCILIATION
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={activeBankId}
            onChange={(e) => setActiveBankId(e.target.value)}
            className="bg-black/60 border border-[#d4af37]/30 text-[#f5d77f] text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#d4af37] transition-all font-mono min-w-[200px]"
          >
            {bankAccounts.length === 0 ? (
              <option value="">Select Bank (None Registered)</option>
            ) : (
              bankAccounts.map((b) => {
                const label = `${b.bank_name} | ${b.account_number}${b.account_holder ? ` | ${b.account_holder}` : ''}`;
                return (
                  <option key={b.id} value={b.id}>
                    {label}
                  </option>
                );
              })
            )}
          </select>

          <select
            value={bankFormat}
            onChange={(e) => setBankFormat(e.target.value)}
            className="bg-black/60 border border-[#d4af37]/30 text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#d4af37] transition-all min-w-[160px]"
          >
            <option value="jago">Bank Jago</option>
            <option value="bca_business">BCA Business (Giro)</option>
            <option value="bca_individual" disabled>BCA Individual (Soon)</option>
          </select>

          <div className="flex items-center gap-2 border border-zinc-700/50 rounded-lg p-1 bg-black/40">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-transparent text-white text-xs font-bold rounded px-2 py-1.5 outline-none hover:bg-zinc-800/50 cursor-pointer"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString('default', { month: 'short' }).toUpperCase()}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-transparent text-white text-xs font-bold font-mono rounded px-2 py-1.5 outline-none w-16 hover:bg-zinc-800/50 focus:bg-zinc-800/80"
              min="2000"
              max="2100"
            />
          </div>

          <label className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-transparent via-[#d4af37]/10 to-transparent border border-[#d4af37]/40 rounded-full text-[#f5d77f] text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/20 hover:border-[#d4af37] transition-all w-full md:w-auto justify-center">
            <UploadCloud className="w-4 h-4" />
            <span>Upload Bank Statement</span>
            <input
              type="file"
              accept=".csv,.pdf"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isPending}
            />
            {isPending && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#f5d77f] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Split-Panel Reconciliation HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="gold-glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                BANK STATEMENT FEED
              </h3>
              <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                <button onClick={() => setActiveFilterTab('all')} className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${activeFilterTab === 'all' ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-400'}`}>ALL</button>
                <button onClick={() => setActiveFilterTab('matched')} className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${activeFilterTab === 'matched' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-400'}`}>MATCHED</button>
                <button onClick={() => setActiveFilterTab('unmatched')} className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${activeFilterTab === 'unmatched' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-zinc-400'}`}>NOT FOUND</button>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {filteredBankLines.length} ITEMS
              </span>
            </div>

            <div className="space-y-3">
              {filteredBankLines.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
                  <div className="text-white font-bold">NO BANK FEED TRANSACTIONS FOUND</div>
                  <div className="text-[10px] text-zinc-400 font-sans">For {new Date(filterYear, filterMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                </div>
              ) : (
                filteredBankLines.map((bank) => {
                  const isSelected = bank.id === selectedBankId;
                  const autoMatch = findAutoMatch(bank);

                  return (
                    <div
                      key={bank.id}
                      onClick={() => {
                        setSelectedBankId(bank.id);
                        setSelectedRecordId(null);
                        // Auto-switch tabs based on amount type if entering resolution mode
                        setResolutionTab(bank.amount < 0 ? 'expense' : 'income');
                      }}
                      className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
                        isSelected
                          ? 'bg-[#d4af37]/15 border-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                          : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span className="text-zinc-400">{bank.date}</span>
                        <div className="flex items-center gap-2">
                          {autoMatch ? (
                            <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold">MATCHED</span>
                          ) : (
                            <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold">NOT FOUND</span>
                          )}
                          <span className={`font-bold ${bank.amount >= 0 ? 'text-[#f5d77f]' : 'text-red-400'}`}>
                            {bank.amount >= 0
                              ? `+Rp ${bank.amount.toLocaleString('en-US')}`
                              : `-Rp ${Math.abs(bank.amount).toLocaleString('en-US')}`}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-sans text-white font-bold tracking-wide flex flex-col gap-1 mt-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>{bank.sourceDestination}</span>
                          {bank.notes && <span className="text-zinc-500 font-normal border-l border-zinc-700 pl-2">{bank.notes}</span>}
                          {bank.transactionDetails && <span className="text-zinc-500 font-normal border-l border-zinc-700 pl-2">{bank.transactionDetails}</span>}
                        </div>
                        {bank.rekFrom && (
                          <div className="text-[10px] text-zinc-500 font-mono font-normal tracking-wider">
                            {bank.rekFrom}
                          </div>
                        )}
                      </div>

                      {autoMatch && (
                        <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-[#f5d77f]">
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#f5d77f] animate-pulse" />
                            <span>GOLD AUTO-MATCH: {autoMatch.reference}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: SYSTEM RECORDS / RESOLUTION WIDGET */}
        <div className="gold-glass-panel rounded-2xl p-6 flex flex-col justify-between">
          {activeBankLine && !autoMatchRecord ? (
            // ================= INLINE RESOLUTION WIDGET =================
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                  UNMATCHED ITEM • RESOLUTION WIDGET
                </h3>
                {resolutionTab === 'manual' ? (
                  <button
                    type="button"
                    disabled={currentTargetRecordIds.length === 0 || isPending}
                    onClick={() => handleMatchAndClear()}
                    className="gold-btn inline-flex items-center gap-2 px-6 py-2 rounded-full text-[10px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isPending 
                        ? 'RECONCILING...' 
                        : (activeBankLine && currentTargetRecordIds.length > 0 && Math.abs(recordsList.filter(r => currentTargetRecordIds.includes(r.id)).reduce((sum, r) => sum + r.amount, 0)) !== Math.abs(activeBankLine.amount))
                          ? 'ADJUST RECORD & RECONCILE' 
                          : `FORCE MATCH & CLEAR ${currentTargetRecordIds.length > 1 ? `(${currentTargetRecordIds.length})` : ''}`}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleQuickResolve}
                    className="gold-btn inline-flex items-center gap-2 px-6 py-2 rounded-full text-[10px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isPending ? 'PROCESSING...' : 'SAVE & RECONCILE'}</span>
                  </button>
                )}
              </div>
              
              {/* Tab Selector */}
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800/80 mb-6">
                <button 
                  onClick={() => setResolutionTab('expense')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${resolutionTab === 'expense' ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                  QUICK EXPENSE
                </button>
                <button 
                  onClick={() => setResolutionTab('income')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${resolutionTab === 'income' ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                  QUICK INCOME
                </button>
                <button 
                  onClick={() => setResolutionTab('manual')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${resolutionTab === 'manual' ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                  MANUAL MATCH
                </button>
              </div>

              {resolutionTab === 'manual' ? (
                // MANUAL MATCH TAB
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2">
                    {renderSystemRecordsList()}
                  </div>
                </div>
              ) : (
                // QUICK EXPENSE / INCOME TAB
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          Vendor / Payee Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text"
                          required
                          placeholder="Search vendor or enter custom text..."
                          value={quickVendorName}
                          onChange={(e) => {
                            setQuickVendorName(e.target.value);
                            setQuickVendorId(undefined); // Unset ID if they type manually
                            setVendorDropdownOpen(true);
                          }}
                          onFocus={() => setVendorDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setVendorDropdownOpen(false), 200)}
                          className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                        />
                        {vendorDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-xl max-h-56 overflow-y-auto top-[100%]">
                            {localVendors
                              .filter(v => v.name.toLowerCase().includes(quickVendorName.toLowerCase()))
                              .map(v => (
                                <div 
                                  key={v.id}
                                  onClick={() => {
                                    setQuickVendorName(v.name);
                                    setQuickVendorId(v.id);
                                    setVendorDropdownOpen(false);
                                  }}
                                  className="px-4 py-2.5 text-xs text-white hover:bg-[#d4af37]/20 cursor-pointer transition-colors"
                                >
                                  {v.name}
                                </div>
                              ))}
                            
                            {/* Quick Add Button */}
                            {quickVendorName.trim() && !localVendors.some(v => v.name.toLowerCase() === quickVendorName.toLowerCase()) && (
                              <div 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleQuickAddVendor();
                                }}
                                className="px-4 py-3 text-xs text-[#f5d77f] font-bold border-t border-zinc-800 hover:bg-[#d4af37]/20 cursor-pointer flex items-center gap-2 transition-colors"
                              >
                                {isQuickAddingVendor ? (
                                  <span className="animate-pulse">ADDING...</span>
                                ) : (
                                  <><span>+ QUICK ADD VENDOR:</span> <span className="text-white">"{quickVendorName}"</span></>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 relative">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Category</label>
                        <input
                          type="text"
                          placeholder="Type to search or enter custom..."
                          value={quickCategory}
                          onChange={(e) => {
                            setQuickCategory(e.target.value);
                            setCoaDropdownOpen(true);
                          }}
                          onFocus={() => setCoaDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setCoaDropdownOpen(false), 200)}
                          className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                        />
                        {coaDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-xl max-h-56 overflow-y-auto top-[100%]">
                            {Object.entries(
                              coaAccounts.reduce((acc, curr) => {
                                if (!acc[curr.account_type]) acc[curr.account_type] = [];
                                acc[curr.account_type].push(curr);
                                return acc;
                              }, {} as Record<string, COAAccountMinimal[]>)
                            ).map(([type, accounts]) => {
                              const searchLower = quickCategory.toLowerCase();
                              const filtered = searchLower === 'uncategorized' ? accounts : accounts.filter(a => 
                                (a.account_code + ' - ' + a.account_name).toLowerCase().includes(searchLower)
                              );
                              if (filtered.length === 0) return null;
                              // Expanded if they are searching for something, otherwise default to collapsed
                              const hasSearchTerm = searchLower.length > 0;
                              const isExpanded = expandedCoaGroups[type] !== undefined 
                                ? expandedCoaGroups[type] 
                                : hasSearchTerm;

                              return (
                                <div key={type}>
                                  <div 
                                    className="px-3 py-1.5 bg-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider sticky top-0 cursor-pointer flex items-center gap-1 hover:text-white transition-colors"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedCoaGroups(prev => {
                                        const current = prev[type] !== undefined ? prev[type] : (searchLower.length > 0);
                                        return { ...prev, [type]: !current };
                                      });
                                    }}
                                  >
                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    {type}
                                  </div>
                                  {isExpanded && filtered.map(coa => (
                                    <div 
                                      key={coa.account_code}
                                      onClick={() => {
                                        setQuickCategory(coa.account_code + ' - ' + coa.account_name);
                                        setCoaDropdownOpen(false);
                                      }}
                                      className="px-4 py-2 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
                                    >
                                      <span className="font-mono text-[#f5d77f]">{coa.account_code}</span>
                                      <span>{coa.account_name}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          Payment Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={quickDate}
                          onChange={(e) => setQuickDate(e.target.value)}
                          className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          Amount (IDR / Rp) *
                        </label>
                        <RupiahInput
                          required
                          placeholder="Rp 0"
                          value={quickAmount}
                          onChange={(e) => setQuickAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                        Memo / Reference Notes
                      </label>
                      <textarea
                        rows={2}
                        value={quickNotes}
                        onChange={(e) => setQuickNotes(e.target.value)}
                        className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // ================= NORMAL SYSTEM RECORDS VIEW =================
            <div className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">SYSTEM RECORDS</h3>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {recordsList.length} QUEUED ENTRIES
                  </span>
                </div>
                <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                  {renderSystemRecordsList()}
                </div>
              </div>
              
              {/* ACTION BUTTON HUD */}
              <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                <div className="text-xs font-mono text-zinc-400">
                  {(() => {
                    if (!activeBankLine || currentTargetRecordIds.length === 0) return <span>SELECT BANK & SYSTEM RECORD</span>;
                    const recAmounts = recordsList.filter(r => currentTargetRecordIds.includes(r.id)).reduce((sum, r) => sum + Math.abs(r.amount), 0);
                    if (recAmounts !== Math.abs(activeBankLine.amount)) {
                      const diff = recAmounts - Math.abs(activeBankLine.amount);
                      return (
                        <span className="text-yellow-400 font-bold">
                          NEEDS ADJUSTMENT (DIFF: {diff > 0 ? '+' : ''}Rp {diff.toLocaleString('en-US')})
                        </span>
                      );
                    }
                    return <span className="text-[#f5d77f] font-bold">READY TO CLEAR (EXACT MATCH)</span>;
                  })()}
                </div>
                <button
                  type="button"
                  disabled={!activeBankLine || currentTargetRecordIds.length === 0 || isPending}
                  onClick={() => handleMatchAndClear()}
                  className="gold-btn inline-flex items-center gap-2 px-7 py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isPending 
                      ? 'RECONCILING...' 
                      : (activeBankLine && currentTargetRecordIds.length > 0 && Math.abs(recordsList.filter(r => currentTargetRecordIds.includes(r.id)).reduce((sum, r) => sum + r.amount, 0)) !== Math.abs(activeBankLine.amount))
                        ? 'ADJUST RECORD & RECONCILE' 
                        : `MATCH & CLEAR ${currentTargetRecordIds.length > 1 ? currentTargetRecordIds.length + ' RECORDS' : 'RECORD'}`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
