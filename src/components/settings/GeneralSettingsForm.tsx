'use client';

import React, { useState, useTransition } from 'react';
import { Save, AlertCircle, Check, Loader2, Plus, Trash2, Star, CreditCard, ShieldCheck } from 'lucide-react';
import { saveWorkspaceSettings, type BankAccountItem } from '@/app/actions/settings';

interface GeneralSettingsFormProps {
  initialName: string;
  initialIsTaxRegistered: boolean;
  initialTaxRate: number;
  initialBankAccounts: BankAccountItem[];
}

export function GeneralSettingsForm({
  initialName = 'Professor Toko Online',
  initialIsTaxRegistered = false,
  initialTaxRate = 11,
  initialBankAccounts = [],
}: Partial<GeneralSettingsFormProps>) {
  const [name, setName] = useState(initialName);
  const [isTaxRegistered, setIsTaxRegistered] = useState(initialIsTaxRegistered);
  const [taxRatePercent, setTaxRatePercent] = useState(initialTaxRate || 11);
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>(initialBankAccounts);

  // New Bank Account Form State
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const handleAddBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newAccountNumber.trim() || !newAccountName.trim()) return;

    const isFirst = bankAccounts.length === 0;
    const newItem: BankAccountItem = {
      id: `temp-${Date.now()}`,
      bank_name: newBankName.trim(),
      account_number: newAccountNumber.trim(),
      account_name: newAccountName.trim(),
      is_default: isFirst,
    };

    setBankAccounts([...bankAccounts, newItem]);
    setNewBankName('');
    setNewAccountNumber('');
    setNewAccountName('');
    setShowAddBank(false);
  };

  const handleDeleteAccount = (id?: string, index?: number) => {
    const updated = bankAccounts.filter((_, i) => (id ? _.id !== id : i !== index));
    // If the deleted one was default, make the first remaining account default
    if (updated.length > 0 && !updated.some((b) => b.is_default)) {
      updated[0].is_default = true;
    }
    setBankAccounts(updated);
  };

  const handleSetDefault = (index: number) => {
    const updated = bankAccounts.map((item, i) => ({
      ...item,
      is_default: i === index,
    }));
    setBankAccounts(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const finalTaxRate = isTaxRegistered ? Number(taxRatePercent) || 0 : 0;

    startTransition(async () => {
      try {
        const res = await saveWorkspaceSettings({
          name,
          isTaxRegistered,
          taxRatePercent: finalTaxRate,
          bankAccounts,
        });

        if (!res.success) {
          setStatusMsg({ type: 'error', text: res.error || 'Failed to save workspace settings.' });
        } else {
          setStatusMsg({
            type: 'success',
            text: 'Workspace identity, tax status, and bank accounts saved successfully.',
          });
        }
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err?.message || 'Unexpected error.' });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="gold-glass-panel rounded-3xl p-6 sm:p-8 space-y-8 max-w-3xl border border-[#d4af37]/40 shadow-[0_0_40px_rgba(212,175,55,0.1)]">
      <div className="border-b border-zinc-800 pb-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
            GENERAL WORKSPACE IDENTITY & TAX PROFILE
          </h2>
          <p className="text-xs text-[#d4af37] font-mono mt-1">
            CONFIGURE ENTERPRISE LEGAL ENTITY AND AUTOMATED PPN / BANK ACCOUNTS
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] uppercase px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40">
          ENTERPRISE TENANT
        </span>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-xs font-mono shadow-sm border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'bg-red-950/60 border-red-700 text-red-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 1. Workspace Name Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] font-mono">
          1. LEGAL ENTITY IDENTITY
        </h3>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
            WORKSPACE / ENTERPRISE NAME *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-sans focus:outline-none focus:border-[#d4af37] transition-all"
          />
        </div>
      </div>

      {/* 2. Tax Registered Entity (PKP) Dynamic Toggle Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-900">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] font-mono">
          2. OFFICIAL TAX REGISTRATION STATUS
        </h3>

        <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-bold text-white cursor-pointer select-none flex items-center gap-2">
                <span>Tax Registered Entity (PKP)</span>
                {isTaxRegistered && (
                  <span className="text-[10px] font-mono text-[#f5d77f] uppercase px-2 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/40">
                    ACTIVE
                  </span>
                )}
              </label>
              <p className="text-xs text-zinc-400 font-sans">
                Toggle ON if this company is legally required to charge and collect PPN / VAT on invoices.
              </p>
            </div>

            {/* Gold Toggle Switch */}
            <button
              type="button"
              onClick={() => setIsTaxRegistered(!isTaxRegistered)}
              disabled={isPending}
              className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center shrink-0 ${
                isTaxRegistered
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#f5d77f] shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                  : 'bg-zinc-800 border border-zinc-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-black transition-transform duration-300 shadow-md ${
                  isTaxRegistered ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Dynamic Tax Rate Input (Revealed only if toggled ON) */}
          {isTaxRegistered && (
            <div className="pt-3 border-t border-zinc-900 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                TAX RATE (%) • PPN PERCENTAGE VALUE
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  required={isTaxRegistered}
                  value={taxRatePercent}
                  onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                  disabled={isPending}
                  className="w-40 bg-black border border-[#d4af37]/50 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#f5d77f] focus:outline-none focus:border-[#d4af37] transition-all"
                />
                <span className="text-xs text-zinc-400 font-mono">
                  Applied automatically to taxable subtotal when generating new invoices.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Bank Accounts Dynamic List Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] font-mono">
            3. SAVED BANK ACCOUNTS & SETTLEMENT METHODS
          </h3>
          <span className="text-[10px] font-mono text-zinc-400">
            {bankAccounts.length} ACCOUNT{bankAccounts.length !== 1 ? 'S' : ''}
          </span>
        </div>

        {/* Vertical List of Bank Accounts */}
        {bankAccounts.length === 0 && !showAddBank ? (
          <div className="p-6 rounded-2xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center space-y-2">
            <CreditCard className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400 font-sans">
              No bank accounts saved yet. Add accounts to render payment instructions clearly on PDF invoices.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bankAccounts.map((account, index) => (
              <div
                key={account.id || `bank-${index}`}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  account.is_default
                    ? 'bg-gradient-to-r from-[#d4af37]/15 to-transparent border-[#d4af37]/60 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                    : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 ${
                      account.is_default
                        ? 'bg-[#d4af37]/20 border-[#d4af37]/60 text-[#f5d77f]'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white truncate font-sans">
                        {account.bank_name}
                      </span>
                      {account.is_default && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#d4af37] text-black shrink-0">
                          <Star className="w-3 h-3 fill-black text-black" />
                          <span>DEFAULT</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-[#f5d77f] mt-0.5">
                      {account.account_number}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-sans uppercase mt-0.5">
                      a/n {account.account_name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!account.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(index)}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-[#d4af37]/40 text-[10px] font-mono font-bold uppercase text-zinc-300 hover:text-[#f5d77f] transition-all"
                    >
                      SET AS DEFAULT
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(account.id, index)}
                    disabled={isPending}
                    title="Remove Bank Account"
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline Add Bank Account Form */}
        {showAddBank ? (
          <div className="p-5 rounded-2xl bg-zinc-950 border border-[#d4af37]/50 space-y-4 animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_25px_rgba(212,175,55,0.15)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[#f5d77f] font-mono flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>ADD NEW BANK ACCOUNT DETAILS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 font-mono">
                  BANK / INSTITUTION NAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank BCA, Wise, Mandiri"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 font-mono">
                  ACCOUNT / VA NUMBER *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 429-577-5778"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 font-mono">
                  ACCOUNT HOLDER NAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g. PT Pintu Langit Inovasi"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddBank(false);
                  setNewBankName('');
                  setNewAccountNumber('');
                  setNewAccountName('');
                }}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono uppercase transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleAddBankAccount}
                disabled={!newBankName.trim() || !newAccountNumber.trim() || !newAccountName.trim()}
                className="px-5 py-2 rounded-xl bg-[#d4af37] text-black font-extrabold text-xs uppercase font-mono disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]"
              >
                ADD ACCOUNT
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddBank(true)}
            disabled={isPending}
            className="w-full py-3 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/40 hover:border-[#d4af37] text-center text-xs font-mono font-bold uppercase text-[#f5d77f] flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(212,175,55,0.1)] group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>+ ADD BANK ACCOUNT</span>
          </button>
        )}
      </div>

      {/* Action Button Update: SAVE WORKSPACE */}
      <div className="pt-5 border-t border-[#d4af37]/20 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="gold-btn inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_30px_rgba(212,175,55,0.35)] disabled:opacity-50 transition-all min-h-[46px]"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Save className="w-4 h-4 text-black" />
          )}
          <span>SAVE WORKSPACE</span>
        </button>
      </div>
    </form>
  );
}
