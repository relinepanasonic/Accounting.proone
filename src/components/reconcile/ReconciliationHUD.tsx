'use client';

import React, { useState, useTransition } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import { reconcileRecord, quickResolveAndReconcile } from '@/app/actions/reconcile';
import { RupiahInput } from '@/components/ui/RupiahInput';

export interface UnreconciledSystemRecord {
  id: string;
  type: 'invoice' | 'expense' | 'payroll';
  reference: string;
  payeeOrClient: string;
  date: string;
  amount: number;
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
}

export function ReconciliationHUD({ systemRecords, bankAccounts = [], coaAccounts = [] }: ReconciliationHUDProps) {
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [recordsList, setRecordsList] = useState<UnreconciledSystemRecord[]>(systemRecords);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Resolution Widget State
  const [resolutionTab, setResolutionTab] = useState<'expense' | 'income' | 'manual'>('expense');
  const [quickCategory, setQuickCategory] = useState<string>('Uncategorized');
  const [quickVendor, setQuickVendor] = useState('');
  const [quickDate, setQuickDate] = useState('');
  const [quickAmount, setQuickAmount] = useState<number | ''>('');
  const [quickNotes, setQuickNotes] = useState('');
  
  const [activeBankId, setActiveBankId] = useState<string>(bankAccounts.length > 0 ? bankAccounts[0].id : '');

  const activeBankLine = bankLines.find((b) => b.id === selectedBankId);
  const autoMatchRecord = activeBankLine ? findAutoMatch(activeBankLine) : null;
  const currentTargetRecordId = selectedRecordId || autoMatchRecord?.id;

  React.useEffect(() => {
    if (activeBankLine) {
      setQuickVendor(activeBankLine.sourceDestination || '');
      setQuickDate(activeBankLine.date || '');
      setQuickAmount(Math.abs(activeBankLine.amount || 0));
      setQuickNotes([activeBankLine.notes, activeBankLine.transactionDetails].filter(Boolean).join(' | '));
    }
  }, [activeBankLine]);

  const findAutoMatch = (bankLine: BankLine) => {
    return recordsList.find(
      (r) =>
        Math.abs(r.amount - Math.abs(bankLine.amount)) < 0.01 &&
        ((bankLine.amount > 0 && r.type === 'invoice') ||
          (bankLine.amount < 0 && r.type === 'expense'))
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      startTransition(async () => {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/v1/reconcile/parse-pdf', {
            method: 'POST',
            body: formData,
          });
          const result = await res.json();
          if (result.success && result.data && result.data.length > 0) {
            const sortedData = result.data.sort((a: BankLine, b: BankLine) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
          const sortedParsed = parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setBankLines(sortedParsed);
          setSelectedBankId(sortedParsed[0].id);
        }
      };
      reader.readAsText(file);
    }
  };


  const handleMatchAndClear = () => {
    if (!activeBankLine || !currentTargetRecordId) return;
    const targetRecord = recordsList.find((r) => r.id === currentTargetRecordId);
    if (!targetRecord) return;

    startTransition(async () => {
      try {
        await reconcileRecord(
          targetRecord.id,
          targetRecord.type,
          `BANK-REF: ${activeBankLine.sourceDestination}`,
          activeBankId
        );

        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        setRecordsList((prev) => prev.filter((r) => r.id !== targetRecord.id));
        setSelectedRecordId(null);
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
        await quickResolveAndReconcile(
          resolutionTab === 'expense' ? 'expense' : 'income',
          quickCategory,
          Number(quickAmount) || Math.abs(activeBankLine.amount),
          quickDate || activeBankLine.date,
          quickVendor || activeBankLine.sourceDestination,
          quickNotes || `BANK-REF: ${activeBankLine.sourceDestination}`,
          activeBankId
        );
        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        setSelectedBankId(null);
      } catch (err) {
        console.error(err);
        alert('Failed to save quick record. Please try again.');
      }
    });
  };

  const renderSystemRecordsList = () => {
    if (recordsList.length === 0) {
      return (
        <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
          <div className="text-white font-bold">NO UNRECONCILED SYSTEM RECORDS</div>
          <div className="text-[10px] text-zinc-400 font-sans">All invoices and expenses are cleared or none have been issued yet.</div>
        </div>
      );
    }

    return recordsList.map((rec) => {
      const isHighlighted = rec.id === currentTargetRecordId;
      const isAuto = autoMatchRecord?.id === rec.id;

      return (
        <div
          key={rec.id}
          onClick={() => setSelectedRecordId(rec.id)}
          className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
            isHighlighted
              ? 'bg-[#d4af37]/20 border-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
              : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-zinc-400">{rec.date}</span>
            <span className="font-bold text-[#f5d77f]">
              Rp {rec.amount.toLocaleString('en-US')}
            </span>
          </div>
          <div className="text-xs font-sans text-white font-medium flex items-center justify-between">
            <span>{rec.payeeOrClient}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-[#d4af37] uppercase border border-[#d4af37]/20">
              {rec.reference}
            </span>
          </div>

          {isAuto && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-[#f5d77f]">
              <span>PARITY CONFIRMED</span>
              <span className="font-bold">100% GOLD MATCH</span>
            </div>
          )}
        </div>
      );
    });
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
              BANK STATEMENT FEED TELEMETRY
            </h2>
            <p className="text-xs text-zinc-400 font-mono">
              BRUSHED GOLD AUTOMATCH PARITY ENGINE
            </p>
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

          <label className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-transparent via-[#d4af37]/10 to-transparent border border-[#d4af37]/40 rounded-full text-[#f5d77f] text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/20 hover:border-[#d4af37] transition-all w-full md:w-auto justify-center">
            <UploadCloud className="w-4 h-4" />
            <span>Upload Statement (.CSV / .PDF)</span>
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
        {/* LEFT PANEL: BANK FEED */}
        <div className="gold-glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5d77f]">
                LEFT PANEL • BANK STATEMENT FEED
              </h3>
              <span className="text-[10px] font-mono text-zinc-400">
                {bankLines.length} UNCLEARED ITEMS
              </span>
            </div>

            <div className="space-y-3">
              {bankLines.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
                  <div className="text-white font-bold">NO BANK FEED TRANSACTIONS LOADED</div>
                  <div className="text-[10px] text-zinc-400 font-sans">Click "UPLOAD STATEMENT" above to import Bank Jago PDFs or standard CSVs.</div>
                </div>
              ) : (
                bankLines.map((bank) => {
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
                        <span className={`font-bold ${bank.amount >= 0 ? 'text-[#f5d77f]' : 'text-red-400'}`}>
                          {bank.amount >= 0
                            ? `+Rp ${bank.amount.toLocaleString('en-US')}`
                            : `-Rp ${Math.abs(bank.amount).toLocaleString('en-US')}`}
                        </span>
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
                   
                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <div className="text-xs font-mono text-zinc-400">
                      {currentTargetRecordId ? <span className="text-[#f5d77f] font-bold">READY TO CLEAR</span> : <span>SELECT SYSTEM RECORD</span>}
                    </div>
                    <button
                      type="button"
                      disabled={!currentTargetRecordId || isPending}
                      onClick={handleMatchAndClear}
                      className="gold-btn inline-flex items-center gap-2 px-7 py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isPending ? 'RECONCILING...' : 'FORCE MATCH & CLEAR'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                // QUICK EXPENSE / INCOME TAB
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          Vendor / Payee Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text"
                          required
                          value={quickVendor}
                          onChange={(e) => setQuickVendor(e.target.value)}
                          className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Category</label>
                        <select 
                          value={quickCategory}
                          onChange={(e) => setQuickCategory(e.target.value)}
                          className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                        >
                          <option value="Uncategorized">Uncategorized</option>
                          {coaAccounts.map(coa => (
                            <option key={coa.account_code} value={coa.account_name}>
                              {coa.account_code} - {coa.account_name}
                            </option>
                          ))}
                        </select>
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


                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <div className="text-xs font-mono text-zinc-400">
                      <span className="text-[#f5d77f] font-bold">READY TO CREATE & CLEAR</span>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleQuickResolve}
                      className="gold-btn inline-flex items-center gap-2 px-7 py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isPending ? 'PROCESSING...' : 'SAVE & RECONCILE'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // ================= NORMAL SYSTEM RECORDS VIEW =================
            <div className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                    RIGHT PANEL • SYSTEM RECORDS
                  </h3>
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
                  {activeBankLine && currentTargetRecordId ? (
                    <span className="text-[#f5d77f] font-bold">READY TO CLEAR</span>
                  ) : (
                    <span>SELECT BANK & SYSTEM RECORD</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!activeBankLine || !currentTargetRecordId || isPending}
                  onClick={handleMatchAndClear}
                  className="gold-btn inline-flex items-center gap-2 px-7 py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPending ? 'RECONCILING...' : 'MATCH & CLEAR RECORD'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
