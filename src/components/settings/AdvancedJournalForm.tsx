'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, CheckCircle2, BookOpen, AlertTriangle } from 'lucide-react';
import { saveAdvancedJournal } from '@/app/actions/opening-balances';

interface JournalLine {
  id: string;
  accountName: string;
  accountType: string;
  debit: number | '';
  credit: number | '';
}

export function AdvancedJournalForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState('2025-12-31');
  const [description, setDescription] = useState('Opening Balance Sheet Migration');

  const [lines, setLines] = useState<JournalLine[]>([
    { id: '1', accountName: '', accountType: 'asset', debit: '', credit: 0 },
    { id: '2', accountName: '', accountType: 'equity', debit: 0, credit: '' },
  ]);

  const addLine = () => {
    setLines([...lines, { id: Math.random().toString(36).substring(7), accountName: '', accountType: 'asset', debit: 0, credit: 0 }]);
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof JournalLine, value: any) => {
    setLines(lines.map(l => {
      if (l.id === id) {
        const newLine = { ...l, [field]: value };
        // Enforce debit OR credit, not both
        if (field === 'debit' && Number(value) > 0) {
          newLine.credit = 0;
        } else if (field === 'credit' && Number(value) > 0) {
          newLine.debit = 0;
        }
        return newLine;
      }
      return l;
    }));
  };

  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;
  const difference = Math.abs(totalDebit - totalCredit);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setErrorMsg('Total Debits must equal Total Credits to post a journal entry.');
      return;
    }

    const cleanLines = lines.filter(l => l.accountName.trim() !== '' && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (cleanLines.length < 2) {
      setErrorMsg('You must have at least two valid lines.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveAdvancedJournal({
          entryDate,
          description,
          lines: cleanLines.map(l => ({
            accountName: l.accountName,
            accountType: l.accountType,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          }))
        });
        
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/ledger'); // Redirect to ledger to see it
        }, 1500);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to post advanced journal');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {isSuccess && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 text-[#f5d77f] font-bold">
            <CheckCircle2 className="w-5 h-5" />
            <span>ADVANCED JOURNAL POSTED TO LEDGER</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 font-bold">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Entry Date</label>
          <input 
            type="date" 
            required 
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Master Description</label>
          <input 
            type="text" 
            required 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Opening Balance Migration"
            className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/50"
          />
        </div>
      </div>

      <div className="border border-[#d4af37]/20 rounded-2xl overflow-hidden bg-black/40">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#d4af37]/20 bg-zinc-950/80">
              <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-wider w-2/5">Account Name</th>
              <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-wider w-1/5">Type</th>
              <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-wider w-1/5 text-right">Debit (Rp)</th>
              <th className="px-4 py-3 text-[10px] font-mono text-zinc-400 uppercase tracking-wider w-1/5 text-right">Credit (Rp)</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {lines.map((line, index) => (
              <tr key={line.id} className="hover:bg-[#d4af37]/5 transition-colors">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Owner's Capital"
                    value={line.accountName}
                    onChange={(e) => updateLine(line.id, 'accountName', e.target.value)}
                    className="w-full bg-transparent border-none text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37]/50 rounded px-2 py-1"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={line.accountType}
                    onChange={(e) => updateLine(line.id, 'accountType', e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-mono text-zinc-300 focus:outline-none cursor-pointer [&>option]:bg-zinc-900 [&>option]:text-white"
                  >
                    <option value="asset">Asset (Aset)</option>
                    <option value="liability">Liability (Kewajiban)</option>
                    <option value="equity">Equity (Modal)</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={line.debit}
                    onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                    className="w-full bg-transparent border-none text-sm text-white focus:outline-none text-right font-mono focus:ring-1 focus:ring-[#d4af37]/50 rounded px-2 py-1"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={line.credit}
                    onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                    className="w-full bg-transparent border-none text-sm text-white focus:outline-none text-right font-mono focus:ring-1 focus:ring-[#d4af37]/50 rounded px-2 py-1"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length <= 2}
                    className="text-zinc-500 hover:text-red-400 disabled:opacity-30 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-3 border-t border-zinc-800/60 bg-zinc-950/40 flex justify-between items-center">
          <button
            type="button"
            onClick={addLine}
            className="text-[10px] font-bold text-[#f5d77f] uppercase tracking-wider flex items-center gap-1 hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
          
          <div className="flex items-center gap-6 font-mono text-xs">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Total Debit</span>
              <span className="text-white">Rp {totalDebit.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Total Credit</span>
              <span className="text-white">Rp {totalCredit.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Balancing Status Bar */}
      <div className={`p-4 rounded-xl flex items-center justify-between border ${isBalanced ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          )}
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
              {isBalanced ? 'Journal is Balanced' : 'Journal is Unbalanced'}
            </h4>
            {!isBalanced && (
              <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                Difference: Rp {difference.toLocaleString('id-ID')}
              </p>
            )}
          </div>
        </div>

        <button 
          type="submit"
          disabled={!isBalanced || isPending}
          className="gold-btn px-6 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <span className="animate-pulse">POSTING...</span>
          ) : (
            <>
              <BookOpen className="w-4 h-4" />
              POST JOURNAL
            </>
          )}
        </button>
      </div>

    </form>
  );
}
