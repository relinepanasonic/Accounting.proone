'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, Save, AlertCircle, Building2 } from 'lucide-react';
import { COAAccount } from '@/app/actions/coa';
import { LedgerMapping, getWorkspaceMappings, saveWorkspaceMapping } from '@/app/actions/mappings';

interface LedgerMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: COAAccount[];
  workspaceId: string;
  workspaceName: string;
  bankAccounts?: any[];
}

export function LedgerMappingModal({ isOpen, onClose, accounts, workspaceId, workspaceName, bankAccounts = [] }: LedgerMappingModalProps) {
  const [mappings, setMappings] = useState<LedgerMapping[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local state for the dropdowns
  const [arCode, setArCode] = useState('');
  const [salesCode, setSalesCode] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [apCode, setApCode] = useState('');
  const [expenseCode, setExpenseCode] = useState('');
  
  // Bank Account mappings (key = bank id, value = account code)
  const [bankMappings, setBankMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadMappings();
    }
  }, [isOpen, workspaceId]);

  const loadMappings = async () => {
    try {
      const data = await getWorkspaceMappings(workspaceId);
      setMappings(data);
      
      setArCode(data.find(m => m.mapping_type === 'AR')?.account_code || '');
      setSalesCode(data.find(m => m.mapping_type === 'SALES')?.account_code || '');
      setTaxCode(data.find(m => m.mapping_type === 'TAX_LIABILITY')?.account_code || '');
      setDiscountCode(data.find(m => m.mapping_type === 'DISCOUNT')?.account_code || '');
      setApCode(data.find(m => m.mapping_type === 'AP')?.account_code || '');
      setExpenseCode(data.find(m => m.mapping_type === 'EXPENSE')?.account_code || '');
      
      const newBankMappings: Record<string, string> = {};
      bankAccounts.forEach(b => {
        newBankMappings[b.id] = data.find(m => m.mapping_type === `BANK_${b.id}`)?.account_code || '';
      });
      setBankMappings(newBankMappings);
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
        if (taxCode) await saveWorkspaceMapping(workspaceId, 'TAX_LIABILITY', taxCode);
        if (discountCode) await saveWorkspaceMapping(workspaceId, 'DISCOUNT', discountCode);
        if (apCode) await saveWorkspaceMapping(workspaceId, 'AP', apCode);
        if (expenseCode) await saveWorkspaceMapping(workspaceId, 'EXPENSE', expenseCode);
        
        // Save Bank mappings
        for (const bankId of Object.keys(bankMappings)) {
          if (bankMappings[bankId]) {
            await saveWorkspaceMapping(workspaceId, `BANK_${bankId}`, bankMappings[bankId]);
          }
        }
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save mappings');
      }
    });
  };

  const updateBankMapping = (bankId: string, code: string) => {
    setBankMappings(prev => ({ ...prev, [bankId]: code }));
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
      
      <div className="relative w-full max-w-3xl bg-[#0a0a0a] border border-[#d4af37]/30 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[90vh]">
        
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Income Mappings */}
            <div className="space-y-4">
              <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-[#f5d77f] uppercase tracking-wider border-b border-white/10 pb-2">
                  Income Mappings (Invoices)
                </h3>
                
                <div>
                  <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                    Default Sales Revenue
                  </label>
                  <select
                    value={salesCode}
                    onChange={(e) => setSalesCode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-[#d4af37]/50 transition-colors"
                  >
                    <option value="">-- Select Account --</option>
                    {revenueAccounts.map(a => <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                    Accounts Receivable (A/R)
                  </label>
                  <select
                    value={arCode}
                    onChange={(e) => setArCode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-[#d4af37]/50 transition-colors"
                  >
                    <option value="">-- Select Account --</option>
                    {assetAccounts.map(a => <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                    Taxes Payable (PPN)
                  </label>
                  <select
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-[#d4af37]/50 transition-colors"
                  >
                    <option value="">-- Select Account --</option>
                    {liabilityAccounts.map(a => <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                    Discounts Given
                  </label>
                  <select
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-[#d4af37]/50 transition-colors"
                  >
                    <option value="">-- Select Account --</option>
                    {revenueAccounts.map(a => <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Expense Mappings */}
              <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-[#f5d77f] uppercase tracking-wider border-b border-white/10 pb-2">
                  Expense Mappings (Bills)
                </h3>
                
                <div>
                  <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                    Default Operating Expense
                  </label>
                  <select
                    value={expenseCode}
                    onChange={(e) => setExpenseCode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-[#d4af37]/50 transition-colors"
                  >
                    <option value="">-- Select Account --</option>
                    {expenseAccounts.map(a => <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
                    Accounts Payable (A/P)
                  </label>
                  <select
                    value={apCode}
                    onChange={(e) => setApCode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-[#d4af37]/50 transition-colors"
                  >
                    <option value="">-- Select Account --</option>
                    {liabilityAccounts.map(a => <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Mappings */}
          <div className="p-4 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider border-b border-[#d4af37]/20 pb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Bank Account Assets
            </h3>
            
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-zinc-400 font-mono">No bank accounts configured for this workspace.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankAccounts.map(bank => (
                  <div key={bank.id} className="bg-black/40 p-3 rounded-lg border border-white/5">
                    <label className="block text-xs font-bold text-white mb-1 truncate">
                      {bank.bank_name} - {bank.account_number}
                    </label>
                    <p className="text-[10px] text-zinc-500 mb-2 truncate">{bank.account_name}</p>
                    <select
                      value={bankMappings[bank.id] || ''}
                      onChange={(e) => updateBankMapping(bank.id, e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-[#f5d77f] font-mono focus:border-[#d4af37]/50 transition-colors"
                    >
                      <option value="">-- Link to COA Asset --</option>
                      {assetAccounts.map(a => <option key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
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
