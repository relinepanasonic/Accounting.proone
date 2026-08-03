'use client';

import React, { useState, useTransition } from 'react';
import { Plus, Search, Check, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { upsertCOAAccount, deleteCOAAccount, COAAccount } from '@/app/actions/coa';

interface COASettingsHUDProps {
  accounts: COAAccount[];
  hasClearance: boolean;
}

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

export function COASettingsHUD({ accounts, hasClearance }: COASettingsHUDProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formId, setFormId] = useState<string | undefined>();
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('Asset');
  const [formDesc, setFormDesc] = useState('');
  const [formParentCode, setFormParentCode] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Delete State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = 
      acc.account_code.toLowerCase().includes(search.toLowerCase()) || 
      acc.account_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'All' || acc.account_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleOpenForm = (acc?: COAAccount) => {
    if (!hasClearance) return;
    setError(null);
    if (acc) {
      setFormId(acc.id);
      setFormCode(acc.account_code);
      setFormName(acc.account_name);
      setFormType(acc.account_type);
      setFormDesc(acc.description || '');
      setFormParentCode(acc.parent_code || '');
      setFormActive(acc.is_active);
    } else {
      setFormId(undefined);
      setFormCode('');
      setFormName('');
      setFormType('Asset');
      setFormDesc('');
      setFormParentCode('');
      setFormActive(true);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasClearance) return;
    setError(null);

    startTransition(async () => {
      try {
        await upsertCOAAccount({
          id: formId,
          account_code: formCode,
          account_name: formName,
          account_type: formType,
          description: formDesc || null,
          parent_code: formParentCode || null,
          is_active: formActive,
        });
        setIsFormOpen(false);
      } catch (err: any) {
        setError(err.message || 'Failed to save COA entry');
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!hasClearance) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteCOAAccount(id);
        setDeleteConfirmId(null);
      } catch (err: any) {
        setError(err.message || 'Failed to delete COA entry');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* HUD Header */}
      <div className="gold-glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-widest text-white uppercase flex items-center gap-2">
            GLOBAL CHART OF ACCOUNTS
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            MASTER LEDGER CODES • APPLIES ACROSS ALL ENTERPRISE WORKSPACES
          </p>
        </div>
        
        {hasClearance && (
          <button
            onClick={() => handleOpenForm()}
            className="gold-btn flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="SEARCH BY CODE OR NAME..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/40 border border-[#d4af37]/20 rounded-xl pl-11 pr-4 py-3 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[#d4af37]/60 transition-colors"
          />
        </div>
        
        <div className="flex bg-black/40 border border-[#d4af37]/20 rounded-xl p-1 overflow-x-auto hide-scrollbar w-full md:w-auto">
          {['All', ...ACCOUNT_TYPES].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                typeFilter === type
                  ? 'bg-[#d4af37]/20 text-[#f5d77f]'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* COA Table List */}
      <div className="gold-glass-panel rounded-2xl overflow-hidden border border-[#d4af37]/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#d4af37]/20 bg-black/40">
                <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Code</th>
                <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Account Name</th>
                <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Type</th>
                <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Status</th>
                {hasClearance && <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d4af37]/10">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm font-mono text-zinc-500">
                    NO ACCOUNTS FOUND MATCHING CRITERIA.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 text-sm font-mono font-bold text-[#f5d77f]">
                      <div className="flex items-center gap-2">
                        {acc.parent_code && <span className="text-zinc-600 pl-4">↳</span>}
                        <span>{acc.account_code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">
                        {acc.parent_code ? <span className="text-zinc-500 mr-2">Sub-Account</span> : null}
                        {acc.account_name}
                      </div>
                      {acc.description && (
                        <div className="text-xs text-zinc-500 mt-1 line-clamp-1">{acc.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-black/60 border border-zinc-800 text-[10px] font-mono text-zinc-300 uppercase">
                        {acc.account_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-red-500/50'}`} />
                        <span className={`text-xs font-mono uppercase ${acc.is_active ? 'text-green-400' : 'text-red-400'}`}>
                          {acc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    {hasClearance && (
                      <td className="px-6 py-4 text-right">
                        {deleteConfirmId === acc.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
                              disabled={isPending}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(acc.id!)}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 font-bold"
                              disabled={isPending}
                            >
                              {isPending ? '...' : 'Confirm'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenForm(acc)}
                              className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(acc.id!)}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/30 shadow-2xl">
            <h3 className="text-lg font-black uppercase text-[#f5d77f] mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#d4af37]" />
              {formId ? 'EDIT ACCOUNT' : 'ADD NEW ACCOUNT'}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Account Code</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]/60"
                    placeholder="e.g. 1000"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Parent Account</label>
                  <select
                    value={formParentCode}
                    onChange={(e) => {
                      const newParent = e.target.value;
                      setFormParentCode(newParent);
                      if (newParent) {
                        const parentAcc = accounts.find(a => a.account_code === newParent);
                        if (parentAcc) setFormType(parentAcc.account_type);
                      }
                    }}
                    className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/60"
                  >
                    <option value="">None (Master Account)</option>
                    {accounts.filter(a => !a.parent_code && a.id !== formId).map(a => (
                      <option key={a.account_code} value={a.account_code}>
                        {a.account_code} - {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Account Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  disabled={!!formParentCode}
                  className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/60 disabled:opacity-50"
                >
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Account Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/60"
                  placeholder="e.g. Cash & Cash Equivalents"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/60 resize-none"
                  placeholder="Optional description of what this account is used for..."
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormActive(!formActive)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${formActive ? 'bg-[#d4af37]' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-black transition-all ${formActive ? 'left-5' : 'left-1'}`} />
                </button>
                <span className="text-xs font-mono uppercase text-zinc-400">
                  {formActive ? 'ACCOUNT IS ACTIVE' : 'ACCOUNT IS INACTIVE'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="gold-btn px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? (
                    <span className="animate-pulse">Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
