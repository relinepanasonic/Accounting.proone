'use client';

import React, { useState, useTransition } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ChevronUp,
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

function payeeSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aL = a.toLowerCase();
  const bL = b.toLowerCase();
  if (aL === bL) return 1;
  const wordsB = bL.split(/\s+/).filter((w) => w.length > 3);
  const matches = wordsB.filter((w) => aL.includes(w));
  return matches.length / Math.max(wordsB.length, 1);
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
  const [showQuickForm, setShowQuickForm] = useState(false);

  const [activeBankId, setActiveBankId] = useState<string>(bankAccounts.length > 0 ? bankAccounts[0].id : '');
  const [bankFormat, setBankFormat] = useState<string>('jago');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [filterMonth, setFilterMonth] = useState<number>(currentMonth);
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [showReconciled, setShowReconciled] = useState(false);

  const activeBankLine = bankLines.find((b) => b.id === selectedBankId);

  function findBestMatch(bankLine: BankLine): UnreconciledSystemRecord | null {
    const candidates = recordsList.filter(
      (r) =>
        !r.reconciled &&
        ((bankLine.amount > 0 && (r.type === 'invoice' || r.type === 'income')) ||
          (bankLine.amount < 0 && (r.type === 'expense' || r.type === 'payroll')))
    );
    let best: UnreconciledSystemRecord | null = null;
    let bestScore = -1;
    for (const r of candidates) {
      const amountMatch = Math.abs(r.amount - Math.abs(bankLine.amount)) < 0.01;
      if (!amountMatch) continue;
      const pScore = payeeSimilarity(bankLine.sourceDestination, r.payeeOrClient || r.reference);
      const score = 0.5 + pScore * 0.5;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best;
  }

  const bestMatchRecord = activeBankLine ? findBestMatch(activeBankLine) : null;
  const currentTargetRecordIds = selectedRecordIds.length > 0 ? selectedRecordIds : (bestMatchRecord ? [bestMatchRecord.id] : []);

  React.useEffect(() => {
    if (activeBankLine) {
      setQuickVendorName(activeBankLine.sourceDestination || '');
      setQuickVendorId(undefined);
      setQuickDate(activeBankLine.date || '');
      setQuickAmount(Math.abs(activeBankLine.amount || 0));
      setQuickNotes([activeBankLine.notes, activeBankLine.transactionDetails].filter(Boolean).join(' | '));
    }
  }, [activeBankLine]);

  const filteredBankLines = React.useMemo(() => {
    return bankLines.filter((b) => {
      const d = new Date(b.date);
      const matchesMonth = d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
      if (!matchesMonth) return false;
      const bm = findBestMatch(b);
      if (activeFilterTab === 'matched') return !!bm;
      if (activeFilterTab === 'unmatched') return !bm;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankLines, filterMonth, filterYear, activeFilterTab, recordsList]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Clear the input so the same file can be selected again
    e.target.value = '';

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      startTransition(async () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bankFormat', bankFormat);
        try {
          const res = await fetch('/api/v1/reconcile/parse-pdf', { method: 'POST', body: formData });
          const result = await res.json();
          if (!result.success) {
            alert('Failed to parse PDF:\n\n' + (result.error || 'Unknown error'));
            return;
          }
          if (result.data && Array.isArray(result.data)) {
            const reconciledSet = new Set(reconciledBankRefs);
            const parsed: BankLine[] = result.data
              .filter((t: any) => !reconciledSet.has(`BANK-REF:${t.date}:${t.amount}:${t.sourceDestination}`))
              .map((t: any, i: number) => ({
                id: `pdf-${i}-${t.date}-${t.amount}`,
                date: t.date, sourceDestination: t.sourceDestination || '',
                transactionDetails: t.transactionDetails || '', notes: t.notes || '',
                rekFrom: t.rekFrom || '', amount: Number(t.amount),
              }));
            
            if (parsed.length === 0) {
              alert('All items in this statement have already been reconciled and filtered out!');
              return;
            }

            const sorted = [...parsed].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setBankLines(sorted);
            if (sorted.length > 0) {
              setSelectedBankId(sorted[0].id);
              const firstDate = new Date(sorted[0].date);
              if (!isNaN(firstDate.getTime())) {
                setFilterMonth(firstDate.getMonth() + 1);
                setFilterYear(firstDate.getFullYear());
              }
            }
          }
        } catch (err) { console.error(err); alert('Failed to parse PDF.'); }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        const reconciledSet = new Set(reconciledBankRefs);
        const parsed: BankLine[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length < 3) continue;
          const date = cols[0]?.trim();
          const sourceDestination = cols[1]?.trim() || '';
          const rawAmt = cols[2]?.trim().replace(/[^0-9.-]/g, '');
          const amount = parseFloat(rawAmt);
          if (!date || isNaN(amount)) continue;
          if (reconciledSet.has(`BANK-REF:${date}:${amount}:${sourceDestination}`)) continue;
          parsed.push({ id: `csv-${i}-${date}-${amount}`, date, sourceDestination, transactionDetails: cols[3]?.trim() || '', notes: cols[4]?.trim() || '', rekFrom: cols[5]?.trim() || '', amount });
        }
        
        if (parsed.length === 0) {
          alert('All items in this statement have already been reconciled and filtered out!');
          return;
        }

        const sorted = [...parsed].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setBankLines(sorted);
        if (sorted.length > 0) {
          setSelectedBankId(sorted[0].id);
          const firstDate = new Date(sorted[0].date);
          if (!isNaN(firstDate.getTime())) {
            setFilterMonth(firstDate.getMonth() + 1);
            setFilterYear(firstDate.getFullYear());
          }
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
          if (targetRecords.length > 1) { alert('Amount mismatch with multiple records. Adjust manually.'); return; }
          if (bankAmountAbs < recordAmountAbs && targetRecords[0].type === 'invoice') {
            const proceed = confirm(`Partial payment?\nBank: Rp ${bankAmountAbs.toLocaleString('id-ID')}\nInvoice: Rp ${recordAmountAbs.toLocaleString('id-ID')}\n\nRecord as PARTIAL PAYMENT?`);
            if (proceed) { isPartialPayment = true; }
            else { if (!confirm('Shrink invoice to match bank?')) return; shouldClearDiff = true; }
          } else {
            if (!confirm(`Amount mismatch!\nBank: Rp ${bankAmountAbs.toLocaleString('id-ID')}\nSystem: Rp ${recordAmountAbs.toLocaleString('id-ID')}\n\nAdjust system to bank amount?`)) return;
            shouldClearDiff = true;
          }
        }
        const uniqueRef = `BANK-REF:${activeBankLine.date}:${activeBankLine.amount}:${activeBankLine.sourceDestination}`;
        for (const targetRecord of targetRecords) {
          await reconcileRecord(targetRecord.id, targetRecord.type, uniqueRef, activeBankId, (shouldClearDiff || isPartialPayment) ? activeBankLine.amount : undefined, isPartialPayment);
        }
        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        if (isPartialPayment) {
          setRecordsList((prev) => prev.map((r) => activeTargetIds.includes(r.id) ? { ...r, amount: r.amount > 0 ? r.amount - bankAmountAbs : r.amount + bankAmountAbs } : r));
        } else {
          setRecordsList((prev) => prev.filter((r) => !activeTargetIds.includes(r.id)));
        }
        setSelectedRecordIds([]);
        setSelectedBankId(null);
      } catch (err) { console.error(err); }
    });
  };

  const handleQuickResolve = (type: 'expense' | 'income') => {
    if (!activeBankLine) return;
    startTransition(async () => {
      try {
        const uniqueBankRef = `BANK-REF:${activeBankLine.date}:${activeBankLine.amount}:${activeBankLine.sourceDestination}`;
        const finalDescription = (quickVendorName ? quickVendorName + ' | ' : '') + quickNotes;
        await quickResolveAndReconcile(type, quickCategory, Number(quickAmount) || Math.abs(activeBankLine.amount), quickDate || activeBankLine.date, finalDescription || 'Quick Resolve', uniqueBankRef, activeBankId, quickVendorId);
        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        setSelectedBankId(null);
        setQuickCategory(''); setQuickVendorName(''); setQuickVendorId(undefined); setQuickNotes(''); setShowQuickForm(false);
      } catch (err) { console.error(err); alert('Failed to save. Please try again.'); }
    });
  };

  const handleQuickAddVendor = async () => {
    if (!quickVendorName.trim()) return;
    setIsQuickAddingVendor(true);
    try {
      const res = await createClientRecord({ name: quickVendorName, contactType: 'vendor' });
      if (res.success && res.client) { setLocalVendors((prev) => [...prev, res.client!]); setQuickVendorId(res.client.id); setVendorDropdownOpen(false); }
      else alert(res.error || 'Failed to create vendor');
    } catch (err: any) { alert(err?.message || 'Error'); }
    finally { setIsQuickAddingVendor(false); }
  };

  const filteredSystemRecords = React.useMemo(() => {
    let list = recordsList.filter((r) => {
      if (!showReconciled && r.reconciled) return false;
      if (activeBankLine) {
        if (activeBankLine.amount > 0) return r.type === 'invoice' || r.type === 'income';
        else return r.type === 'expense' || r.type === 'payroll';
      }
      const d = new Date(r.date);
      return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
    });
    if (activeBankLine) {
      list = list.sort((a, b) => {
        const aScore = (Math.abs(a.amount - Math.abs(activeBankLine.amount)) < 0.01 ? 1 : 0) + payeeSimilarity(activeBankLine.sourceDestination, a.payeeOrClient || a.reference);
        const bScore = (Math.abs(b.amount - Math.abs(activeBankLine.amount)) < 0.01 ? 1 : 0) + payeeSimilarity(activeBankLine.sourceDestination, b.payeeOrClient || b.reference);
        return bScore - aScore;
      });
    } else {
      list = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return list;
  }, [recordsList, showReconciled, activeBankLine, filterMonth, filterYear]);

  const bankAmt = activeBankLine ? Math.abs(activeBankLine.amount) : 0;
  const selectedRecords = recordsList.filter((r) => currentTargetRecordIds.includes(r.id));
  const systemAmt = selectedRecords.reduce((s, r) => s + Math.abs(r.amount), 0);
  const diff = systemAmt - bankAmt;
  const isExactMatch = bankAmt > 0 && Math.abs(diff) < 0.01;
  const canMatch = !!activeBankLine && currentTargetRecordIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Controls Strip */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8 p-6 gold-glass-panel rounded-2xl border border-[#d4af37]/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#8a7322] p-0.5 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <div className="w-full h-full bg-black/80 rounded-[10px] flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-[#d4af37]" />
            </div>
          </div>
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">BANK RECONCILIATION</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={activeBankId} onChange={(e) => setActiveBankId(e.target.value)} className="bg-black/60 border border-[#d4af37]/30 text-[#f5d77f] text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#d4af37] font-mono min-w-[200px]">
            {bankAccounts.length === 0 ? <option value="">Select Bank (None Registered)</option> : bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bank_name} | {b.account_number}{b.account_holder ? ` | ${b.account_holder}` : ''}</option>)}
          </select>
          <select value={bankFormat} onChange={(e) => setBankFormat(e.target.value)} className="bg-black/60 border border-[#d4af37]/30 text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#d4af37] min-w-[160px]">
            <option value="jago">Bank Jago</option>
            <option value="bca_business">BCA Business (Giro)</option>
            <option value="bca_individual" disabled>BCA Individual (Soon)</option>
          </select>
          <div className="flex items-center gap-2 border border-zinc-700/50 rounded-lg p-1 bg-black/40">
            <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="bg-transparent text-white text-xs font-bold rounded px-2 py-1.5 outline-none hover:bg-zinc-800/50 cursor-pointer">
              {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString('default', { month: 'short' }).toUpperCase()}</option>)}
            </select>
            <input type="number" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="bg-transparent text-white text-xs font-bold font-mono rounded px-2 py-1.5 outline-none w-16 hover:bg-zinc-800/50" min="2000" max="2100" />
          </div>
          <label className="relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-transparent via-[#d4af37]/10 to-transparent border border-[#d4af37]/40 rounded-full text-[#f5d77f] text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/20 hover:border-[#d4af37] transition-all">
            <UploadCloud className="w-4 h-4" />
            <span>Upload Bank Statement</span>
            <input type="file" accept=".csv,.pdf" className="hidden" onChange={handleFileUpload} disabled={isPending} />
            {isPending && <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"><div className="w-4 h-4 border-2 border-[#f5d77f] border-t-transparent rounded-full animate-spin" /></div>}
          </label>
        </div>
      </div>

      {/* 3-Column Layout: Bank | Connector | System Records */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px_1fr] items-start h-[700px]">

        {/* LEFT: Bank Statement Feed */}
        <div className="gold-glass-panel rounded-2xl lg:rounded-r-none lg:border-r-0 p-6 flex flex-col h-full min-w-0">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">BANK STATEMENT FEED</h3>
            <div className="flex items-center gap-2">
              <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                <button onClick={() => setActiveFilterTab('all')} className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${activeFilterTab === 'all' ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-400'}`}>ALL</button>
                <button onClick={() => setActiveFilterTab('matched')} className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${activeFilterTab === 'matched' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-400'}`}>MATCHED</button>
                <button onClick={() => setActiveFilterTab('unmatched')} className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${activeFilterTab === 'unmatched' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-zinc-400'}`}>NOT FOUND</button>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">{filteredBankLines.length} ITEMS</span>
            </div>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {filteredBankLines.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
                <div className="text-white font-bold">NO BANK FEED TRANSACTIONS</div>
                <div className="text-[10px] text-zinc-400 font-sans">Upload a statement for {new Date(filterYear, filterMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
              </div>
            ) : filteredBankLines.map((bank) => {
              const isSelected = bank.id === selectedBankId;
              const bm = findBestMatch(bank);
              const pScore = bm ? payeeSimilarity(bank.sourceDestination, bm.payeeOrClient || bm.reference) : 0;
              return (
                <div key={bank.id} onClick={() => { setSelectedBankId(isSelected ? null : bank.id); setSelectedRecordIds([]); }}
                  className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${isSelected ? 'bg-[#d4af37]/15 border-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.25)]' : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'}`}>
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-zinc-400">{bank.date}</span>
                    <div className="flex items-center gap-2">
                      {bm ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pScore > 0.3 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {pScore > 0.3 ? '\u2605 BEST MATCH' : 'SUGGESTED'}
                        </span>
                      ) : <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold">NOT FOUND</span>}
                      <span className={`font-bold ${bank.amount >= 0 ? 'text-[#f5d77f]' : 'text-red-400'}`}>
                        {bank.amount >= 0 ? `+Rp ${bank.amount.toLocaleString('en-US')}` : `-Rp ${Math.abs(bank.amount).toLocaleString('en-US')}`}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-sans text-white font-bold mt-2 break-words whitespace-normal">{bank.sourceDestination}</div>
                  {(bank.notes || bank.transactionDetails) && <div className="text-xs text-zinc-500 mt-0.5 break-words whitespace-normal">{bank.notes || bank.transactionDetails}</div>}
                  {bank.rekFrom && <div className="text-[10px] text-zinc-600 font-mono mt-0.5 break-all">{bank.rekFrom}</div>}
                  {bm && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center gap-1.5 text-[10px] font-mono text-[#f5d77f]">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span className="truncate">\u2192 {bm.payeeOrClient || bm.reference}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MIDDLE: Connector with MATCH button */}
        <div className="hidden lg:flex flex-col items-center justify-start bg-zinc-950/90 border border-zinc-800/60 border-x-0 h-full px-3 pt-12 gap-5 overflow-y-auto">
          
          <button
            type="button"
            disabled={!activeBankLine}
            onClick={() => {
              setSelectedRecordIds([]);
              setShowQuickForm(true);
            }}
            className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-zinc-700 w-full disabled:opacity-40 disabled:cursor-not-allowed text-center"
          >
            <span>NO MATCH?</span>
            <span className="text-[8px] font-mono opacity-60">Log Quick Entry</span>
          </button>

          <div className="w-8 h-[1px] bg-zinc-800 my-1"></div>

          <button
            type="button"
            disabled={!canMatch || isPending}
            onClick={() => handleMatchAndClear()}
            className={`flex flex-col items-center gap-1.5 px-5 py-4 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border w-full ${
              canMatch
                ? 'bg-gradient-to-b from-[#d4af37] to-[#8a7322] text-black border-[#f5d77f]/40 shadow-[0_0_20px_rgba(212,175,55,0.5)] hover:shadow-[0_0_30px_rgba(212,175,55,0.7)] hover:scale-105 cursor-pointer'
                : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isPending ? '...' : 'MATCH'}</span>
          </button>
          {!canMatch && <div className="text-[9px] text-zinc-600 text-center font-mono px-2 leading-relaxed mb-2">SELECT<br />ONE EACH<br />SIDE</div>}

          {canMatch && (
            <div className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${isExactMatch ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : diff > 0 ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' : 'text-blue-400 border-blue-400/30 bg-blue-400/10'}`}>
              {isExactMatch ? 'EXACT' : `${diff > 0 ? '+' : ''}Rp ${Math.abs(diff).toLocaleString('id-ID')}`}
            </div>
          )}

          <div className="flex flex-col gap-2 w-full mt-2 items-center">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider text-center">Bank</div>
            <div className={`text-[11px] font-mono font-bold text-center leading-snug ${bankAmt > 0 ? 'text-[#f5d77f]' : 'text-zinc-700'}`}>
              {bankAmt > 0 ? `Rp ${bankAmt.toLocaleString('id-ID')}` : '\u2014'}
            </div>
            
            <div className="flex justify-center my-1"><ArrowRight className="w-4 h-4 text-zinc-700 rotate-90" /></div>
            
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider text-center">System</div>
            <div className={`text-[11px] font-mono font-bold text-center leading-snug ${systemAmt > 0 ? 'text-white' : 'text-zinc-700'}`}>
              {systemAmt > 0 ? `Rp ${systemAmt.toLocaleString('id-ID')}` : '\u2014'}
            </div>
          </div>
        </div>

        {/* RIGHT: System Records */}
        <div className="gold-glass-panel rounded-2xl lg:rounded-l-none lg:border-l-0 p-6 flex flex-col h-full min-w-0">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">SYSTEM RECORDS</h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={showReconciled} onChange={(e) => setShowReconciled(e.target.checked)} className="accent-[#d4af37]" />
                Show cleared
              </label>
              <span className="text-[10px] font-mono text-zinc-400">{recordsList.length} QUEUED</span>
            </div>
          </div>

          {/* Quick Log - collapsible */}
          <div className="mb-4 pb-4 border-b border-zinc-800">
            <button type="button" onClick={() => setShowQuickForm((v) => !v)}
              className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors">
              <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />Quick Log — no matching record?</span>
              {showQuickForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showQuickForm && (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Vendor / Payee</label>
                  <input type="text" placeholder="Search or enter name..." value={quickVendorName}
                    onChange={(e) => { setQuickVendorName(e.target.value); setQuickVendorId(undefined); setVendorDropdownOpen(true); }}
                    onFocus={() => setVendorDropdownOpen(true)} onBlur={() => setTimeout(() => setVendorDropdownOpen(false), 200)}
                    className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]" />
                  {vendorDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto top-[100%]">
                      {localVendors.filter((v) => v.name.toLowerCase().includes(quickVendorName.toLowerCase())).map((v) => (
                        <div key={v.id} onClick={() => { setQuickVendorName(v.name); setQuickVendorId(v.id); setVendorDropdownOpen(false); }} className="px-4 py-2.5 text-xs text-white hover:bg-[#d4af37]/20 cursor-pointer">{v.name}</div>
                      ))}
                      {quickVendorName.trim() && !localVendors.some((v) => v.name.toLowerCase() === quickVendorName.toLowerCase()) && (
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickAddVendor(); }} className="px-4 py-3 text-xs text-[#f5d77f] font-bold border-t border-zinc-800 hover:bg-[#d4af37]/20 cursor-pointer flex items-center gap-2">
                          {isQuickAddingVendor ? <span className="animate-pulse">ADDING...</span> : <span>+ QUICK ADD: &ldquo;{quickVendorName}&rdquo;</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Category</label>
                  <input type="text" placeholder="Search category..." value={quickCategory}
                    onChange={(e) => { setQuickCategory(e.target.value); setCoaDropdownOpen(true); }}
                    onFocus={() => setCoaDropdownOpen(true)} onBlur={() => setTimeout(() => setCoaDropdownOpen(false), 200)}
                    className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]" />
                  {coaDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto top-[100%]">
                      {Object.entries(coaAccounts.reduce((acc, curr) => { if (!acc[curr.account_type]) acc[curr.account_type] = []; acc[curr.account_type].push(curr); return acc; }, {} as Record<string, COAAccountMinimal[]>)).map(([type, accounts]) => {
                        const filtered = accounts.filter((a) => (a.account_code + ' - ' + a.account_name).toLowerCase().includes(quickCategory.toLowerCase()));
                        if (filtered.length === 0) return null;
                        const isExpanded = expandedCoaGroups[type] !== undefined ? expandedCoaGroups[type] : quickCategory.length > 0;
                        return (
                          <div key={type}>
                            <div className="px-3 py-1.5 bg-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider sticky top-0 cursor-pointer flex items-center gap-1 hover:text-white"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setExpandedCoaGroups((prev) => ({ ...prev, [type]: !(prev[type] !== undefined ? prev[type] : quickCategory.length > 0) }))}>
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}{type}
                            </div>
                            {isExpanded && filtered.map((coa) => (
                              <div key={coa.account_code} onClick={() => { setQuickCategory(coa.account_code + ' - ' + coa.account_name); setCoaDropdownOpen(false); }}
                                className="px-4 py-2 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white cursor-pointer flex items-center gap-2">
                                <span className="font-mono text-[#f5d77f]">{coa.account_code}</span><span>{coa.account_name}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Date</label>
                    <input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Amount</label>
                    <RupiahInput placeholder="Rp 0" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#f5d77f] focus:outline-none focus:border-[#d4af37]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Notes</label>
                  <textarea rows={2} value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]" />
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={isPending || !activeBankLine} onClick={() => handleQuickResolve('expense')}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-red-400/30 text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {isPending ? '...' : '\u2212 EXPENSE'}
                  </button>
                  <button type="button" disabled={isPending || !activeBankLine} onClick={() => handleQuickResolve('income')}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-emerald-400/30 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {isPending ? '...' : '+ INCOME'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile MATCH bar */}
          <div className="flex lg:hidden items-center justify-between mb-4 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
            <div className="text-xs font-mono">
              {canMatch ? isExactMatch ? <span className="text-emerald-400 font-bold">EXACT MATCH</span> : <span className="text-yellow-400 font-bold">DIFF: Rp {Math.abs(diff).toLocaleString('id-ID')}</span> : <span className="text-zinc-500">Select bank + system record</span>}
            </div>
            <button type="button" disabled={!canMatch || isPending} onClick={() => handleMatchAndClear()} className="gold-btn inline-flex items-center gap-2 px-5 py-2 rounded-full text-[10px] uppercase tracking-wider disabled:opacity-40">
              <CheckCircle2 className="w-4 h-4" />{isPending ? '...' : 'MATCH'}
            </button>
          </div>

          {/* Records list */}
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {filteredSystemRecords.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
                <div className="text-white font-bold">NO SYSTEM RECORDS</div>
                <div className="text-[10px] text-zinc-400 font-sans">
                  {activeBankLine ? `No ${activeBankLine.amount > 0 ? 'income/invoices' : 'expenses/payroll'} to match.` : 'All records are cleared.'}
                </div>
              </div>
            ) : filteredSystemRecords.map((rec) => {
              const isSelected = currentTargetRecordIds.includes(rec.id);
              const isBest = bestMatchRecord?.id === rec.id;
              const amountMatch = activeBankLine && Math.abs(rec.amount - Math.abs(activeBankLine.amount)) < 0.01;
              const pScore = activeBankLine ? payeeSimilarity(activeBankLine.sourceDestination, rec.payeeOrClient || rec.reference) : 0;
              return (
                <div key={rec.id}
                  onClick={() => setSelectedRecordIds((prev) => prev.includes(rec.id) ? prev.filter((id) => id !== rec.id) : [...prev, rec.id])}
                  className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${isSelected ? 'bg-[#d4af37]/20 border-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.25)]' : isBest ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50' : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'}`}>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="text-zinc-400">{rec.date}</span>
                    <span className={`font-bold ${rec.amount > 0 ? 'text-[#f5d77f]' : 'text-red-400'}`}>
                      {rec.amount > 0 ? `+Rp ${rec.amount.toLocaleString('en-US')}` : `-Rp ${Math.abs(rec.amount).toLocaleString('en-US')}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-sans text-white font-medium truncate">{rec.payeeOrClient || rec.reference}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-[#d4af37] uppercase border border-[#d4af37]/20 shrink-0">{rec.type}</span>
                  </div>
                  {rec.notes && <div className="text-[10px] text-zinc-500 font-mono mt-1 truncate">{rec.notes}</div>}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {rec.reconciled && <span className="text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px]">ALREADY CLEARED</span>}
                    {isBest && amountMatch && pScore > 0.3 && <span className="text-[#f5d77f] font-bold bg-[#d4af37]/10 px-1.5 py-0.5 rounded text-[9px]">\u2605 BEST MATCH</span>}
                    {isBest && amountMatch && pScore <= 0.3 && <span className="text-yellow-400 font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded text-[9px]">SAME AMOUNT</span>}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
