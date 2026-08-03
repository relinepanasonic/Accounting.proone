'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { COAAccount } from '@/app/actions/coa';
import { LedgerMapping, getWorkspaceMappings, saveWorkspaceMapping } from '@/app/actions/mappings';

interface LedgerMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: COAAccount[];
  workspaceId: string;
  workspaceName: string;
}

export function LedgerMappingModal({ isOpen, onClose, accounts, workspaceId, workspaceName }: LedgerMappingModalProps) {
  const [mappings, setMappings] = useState<LedgerMapping[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local state for the dropdowns
  const [arCode, setArCode] = useState('');
  const [salesCode, setSalesCode] = useState('');
  const [apCode, setApCode] = useState('');
  const [expenseCode, setExpenseCode] = useState('');

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadMappings();
    }
  }, [isOpen, workspaceId]);

  const loadMappings = async () => {
    try {
      const data = await getWorkspaceMappings(workspaceId);
      setMappings(data);
      
      const ar = data.find(m => m.mapping_type === 'AR')?.account_code || '';
      const sales = data.find(m => m.mapping_type === 'SALES')?.account_code || '';
      const ap = data.find(m => m.mapping_type === 'AP')?.account_code || '';
      const exp = data.find(m => m.mapping_type === 'EXPENSE')?.account_code || '';
      
      setArCode(ar);
      setSalesCode(sales);
      setApCode(ap);
      setExpenseCode(exp);
    } catch (err: any) {
      setError('Failed to load mappings');
    }
  };

  const handleSave = async () => {
    setError(null);
    startTransition(async () => {
      try {
        if (arCode) await saveWorkspaceMapping(workspaceId, 'AR', arCode);
        if (salesCode) await saveWorkspaceMapping(workspaceId, 'SALES', salesCode);
        if (apCode) await saveWorkspaceMapping(workspaceId, 'AP', apCode);
        if (expenseCode) await saveWorkspaceMapping(workspaceId, 'EXPENSE', expenseCode);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save mappings');
      }
    });
  };

  if (!isOpen) return null;

  // Filter accounts for dropdowns
  const assetAccounts = accounts.filter(a => a.account_type === 'Asset');
  const revenueAccounts = accounts.filter(a => a.account_type === 'Revenue');
  const liabilityAccounts = accounts.filter(a => a.account_type === 'Liability');
  const expenseAccounts = accounts.filter(a => a.account_type === 'Expense');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-[#d4af37]/30 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex-none p-6 border-b border-[#d4af37]/20 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black tracking-widest text-[#d4af37] uppercase">
                Ledger Mappings
              </h2>
              <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-mono">
                Workspace: <span className="text-white">{workspaceName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">
                Income Mappings (Invoices)
              </h3>
              
              <div>
                <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                  Default Sales / Revenue Account
                </label>
                <select
                  value={salesCode}
                  onChange={(e) => setSalesCode(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#d4af37]/50 transition-colors"
                >
                  <option value="">-- Global Default (4001) --</option>
                  {revenueAccounts.map(a => (
                    <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">Credited when an invoice is issued.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                  Default Accounts Receivable (A/R)
                </label>
                <select
                  value={arCode}
                  onChange={(e) => setArCode(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#d4af37]/50 transition-colors"
                >
                  <option value="">-- Global Default (1002) --</option>
                  {assetAccounts.map(a => (
                    <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">Debited when an invoice is issued.</p>
              </div>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">
                Expense Mappings (Bills)
              </h3>
              
              <div>
                <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                  Default Operating Expense Account
                </label>
                <select
                  value={expenseCode}
                  onChange={(e) => setExpenseCode(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#d4af37]/50 transition-colors"
                >
                  <option value="">-- Global Default (5100) --</option>
                  {expenseAccounts.map(a => (
                    <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">Debited when an expense is recorded.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                  Default Accounts Payable (A/P)
                </label>
                <select
                  value={apCode}
                  onChange={(e) => setApCode(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#d4af37]/50 transition-colors"
                >
                  <option value="">-- Global Default (2000) --</option>
                  {liabilityAccounts.map(a => (
                    <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">Credited when an expense is recorded.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none p-6 border-t border-[#d4af37]/20 bg-black/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-6 py-2.5 rounded-full text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="gold-btn flex items-center gap-2 px-8 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Mappings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
