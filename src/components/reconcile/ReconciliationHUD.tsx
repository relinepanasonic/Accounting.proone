'use client';

import React, { useState, useTransition } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { reconcileRecord } from '@/app/actions/reconcile';

export interface UnreconciledSystemRecord {
  id: string;
  type: 'invoice' | 'expense';
  reference: string;
  payeeOrClient: string;
  date: string;
  amount: number;
}

interface BankLine {
  id: string;
  date: string;
  description: string;
  amount: number;
  matchedRecordId?: string;
}

const SAMPLE_BANK_STATEMENT: BankLine[] = [
  {
    id: 'bank-001',
    date: '2026-07-02',
    description: 'TRANSFER INVOICE INV-2026-001 PROF TOKO ONLINE',
    amount: 149870,
  },
  {
    id: 'bank-002',
    date: '2026-07-07',
    description: 'ACH DEBIT CLOUD SERVER HOSTING A/P',
    amount: -1200,
  },
  {
    id: 'bank-003',
    date: '2026-07-10',
    description: 'WIRE OUTWARD STUDIO RENT POWER UTILITIES',
    amount: -4300,
  },
];

interface ReconciliationHUDProps {
  systemRecords: UnreconciledSystemRecord[];
}

export function ReconciliationHUD({ systemRecords }: ReconciliationHUDProps) {
  const [bankLines, setBankLines] = useState<BankLine[]>(SAMPLE_BANK_STATEMENT);
  const [recordsList, setRecordsList] = useState<UnreconciledSystemRecord[]>(systemRecords);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(SAMPLE_BANK_STATEMENT[0].id);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Smart Auto-Matching Helper
  const findAutoMatch = (bankLine: BankLine) => {
    return recordsList.find(
      (r) =>
        Math.abs(r.amount - Math.abs(bankLine.amount)) < 0.01 &&
        ((bankLine.amount > 0 && r.type === 'invoice') ||
          (bankLine.amount < 0 && r.type === 'expense'))
    );
  };

  // CSV File Uploader Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      const parsed: BankLine[] = [];

      // Assume CSV header: Date,Description,Amount
      lines.slice(1).forEach((line, idx) => {
        const cols = line.split(',');
        if (cols.length >= 3) {
          const amt = parseFloat(cols[2].trim());
          if (!isNaN(amt)) {
            parsed.push({
              id: `csv-${idx}`,
              date: cols[0].trim(),
              description: cols[1].trim(),
              amount: amt,
            });
          }
        }
      });

      if (parsed.length > 0) {
        setBankLines(parsed);
        setSelectedBankId(parsed[0].id);
      }
    };
    reader.readAsText(file);
  };

  const activeBankLine = bankLines.find((b) => b.id === selectedBankId);
  const autoMatchRecord = activeBankLine ? findAutoMatch(activeBankLine) : null;
  const currentTargetRecordId = selectedRecordId || autoMatchRecord?.id;

  const handleMatchAndClear = () => {
    if (!activeBankLine || !currentTargetRecordId) return;
    const targetRecord = recordsList.find((r) => r.id === currentTargetRecordId);
    if (!targetRecord) return;

    startTransition(async () => {
      try {
        await reconcileRecord(
          targetRecord.id,
          targetRecord.type,
          `BANK-REF: ${activeBankLine.description}`
        );

        // Remove from UI lists
        setBankLines((prev) => prev.filter((b) => b.id !== activeBankLine.id));
        setRecordsList((prev) => prev.filter((r) => r.id !== targetRecord.id));
        setSelectedRecordId(null);
        setSelectedBankId(null);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload & Demo Strip */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              BANK STATEMENT FEED TELEMETRY
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              UPLOAD RAW CSV STATEMENT OR USE PRE-LOADED SMART FEED
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-xs font-bold text-cyan-400 transition-all">
            <UploadCloud className="w-4 h-4" />
            <span>UPLOAD BANK STATEMENT (.CSV)</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Split-Panel Reconciliation HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL: BANK FEED */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <span>LEFT PANEL • BANK STATEMENT RAW FEED</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {bankLines.length} UNCLEARED ITEMS
              </span>
            </div>

            <div className="space-y-3">
              {bankLines.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  ALL BANK FEED ITEMS FULLY MATCHED & RECONCILED!
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
                      }}
                      className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/60 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span className="text-slate-400">{bank.date}</span>
                        <span
                          className={`font-bold ${
                            bank.amount >= 0 ? 'text-cyan-400' : 'text-amber-400'
                          }`}
                        >
                          {bank.amount >= 0
                            ? `+$${bank.amount.toLocaleString()}`
                            : `-$${Math.abs(bank.amount).toLocaleString()}`}
                        </span>
                      </div>
                      <div className="text-xs font-sans text-white font-medium">
                        {bank.description}
                      </div>

                      {autoMatch && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-cyan-300">
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                            <span>SMART AUTO-MATCH FOUND: {autoMatch.reference}</span>
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

        {/* RIGHT PANEL: UNRECONCILED SYSTEM RECORDS */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <span>RIGHT PANEL • UNRECONCILED SYSTEM RECORDS</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {recordsList.length} QUEUED LEDGER ENTRIES
              </span>
            </div>

            <div className="space-y-3">
              {recordsList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  NO PENDING UNRECONCILED RECORDS
                </div>
              ) : (
                recordsList.map((rec) => {
                  const isHighlighted = rec.id === currentTargetRecordId;
                  const isAuto = autoMatchRecord?.id === rec.id;

                  return (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecordId(rec.id)}
                      className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${
                        isHighlighted
                          ? 'bg-amber-500/10 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span className="text-slate-400">{rec.date}</span>
                        <span
                          className={`font-bold ${
                            rec.type === 'invoice' ? 'text-cyan-400' : 'text-amber-400'
                          }`}
                        >
                          ${rec.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs font-sans text-white font-medium flex items-center justify-between">
                        <span>{rec.payeeOrClient}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                          {rec.reference}
                        </span>
                      </div>

                      {isAuto && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-cyan-300">
                          <span>SYSTEM MATCH RECOGNIZED</span>
                          <span className="text-cyan-400 font-bold">100% PARITY</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ACTION BUTTON HUD */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs font-mono text-slate-400">
              {activeBankLine && currentTargetRecordId ? (
                <span className="text-cyan-400 font-bold">READY TO CLEAR TRANSACTION</span>
              ) : (
                <span>SELECT A BANK ITEM & SYSTEM RECORD</span>
              )}
            </div>

            <button
              type="button"
              disabled={!activeBankLine || !currentTargetRecordId || isPending}
              onClick={handleMatchAndClear}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 hover:from-cyan-300 hover:to-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(34,211,238,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isPending ? 'RECONCILING...' : 'MATCH & CLEAR RECORD'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
