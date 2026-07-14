'use client';

import React, { useState, useTransition } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
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
}

const SAMPLE_BANK_STATEMENT: BankLine[] = [
  { id: 'bank-001', date: '2026-07-02', description: 'TRANSFER INVOICE INV-2026-001 PROF TOKO ONLINE', amount: 149870000 },
  { id: 'bank-002', date: '2026-07-07', description: 'ACH DEBIT CLOUD SERVER HOSTING A/P', amount: -18000000 },
  { id: 'bank-003', date: '2026-07-10', description: 'WIRE OUTWARD STUDIO RENT POWER UTILITIES', amount: -64500000 },
];

interface ReconciliationHUDProps {
  systemRecords: UnreconciledSystemRecord[];
}

export function ReconciliationHUD({ systemRecords }: ReconciliationHUDProps) {
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [recordsList, setRecordsList] = useState<UnreconciledSystemRecord[]>(systemRecords);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      <div className="gold-glass-panel rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#f5d77f]">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              BANK STATEMENT FEED TELEMETRY
            </h3>
            <p className="text-[10px] text-[#d4af37] font-mono">
              BRUSHED GOLD AUTOMATCH PARITY ENGINE
            </p>
          </div>
        </div>

        <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-950 border border-[#d4af37]/40 hover:border-[#f5d77f] text-xs font-bold text-[#f5d77f] transition-all">
          <UploadCloud className="w-4 h-4" />
          <span>UPLOAD STATEMENT (.CSV)</span>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </label>
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
                  <div className="text-[10px] text-zinc-400 font-sans">Click "UPLOAD STATEMENT (.CSV)" above to import bank feed items.</div>
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
                          ? 'bg-[#d4af37]/15 border-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                          : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span className="text-zinc-400">{bank.date}</span>
                        <span className="font-bold text-[#f5d77f]">
                          {bank.amount >= 0
                            ? `+Rp ${bank.amount.toLocaleString('id-ID')}`
                            : `-Rp ${Math.abs(bank.amount).toLocaleString('id-ID')}`}
                        </span>
                      </div>
                      <div className="text-xs font-sans text-white font-medium">
                        {bank.description}
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

        {/* RIGHT PANEL: SYSTEM RECORDS */}
        <div className="gold-glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                RIGHT PANEL • SYSTEM RECORDS
              </h3>
              <span className="text-[10px] font-mono text-zinc-400">
                {recordsList.length} QUEUED ENTRIES
              </span>
            </div>

            <div className="space-y-3">
              {recordsList.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
                  <div className="text-white font-bold">NO UNRECONCILED SYSTEM RECORDS</div>
                  <div className="text-[10px] text-zinc-400 font-sans">All invoices and expenses are cleared or none have been issued yet.</div>
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
                          ? 'bg-[#d4af37]/20 border-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                          : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span className="text-zinc-400">{rec.date}</span>
                        <span className="font-bold text-[#f5d77f]">
                          Rp {rec.amount.toLocaleString('id-ID')}
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
                })
              )}
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
      </div>
    </div>
  );
}
