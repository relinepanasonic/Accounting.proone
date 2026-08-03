'use client';

import React, { useState, useTransition } from 'react';
import { Plus, Search, Check, AlertCircle, Edit2, Trash2, BookOpen, Copy, ChevronDown, ChevronRight, X, Loader2 } from 'lucide-react';
import { upsertCOAAccount, deleteCOAAccount, COAAccount } from '@/app/actions/coa';
import { getJournalEntriesForAccount, JournalEntry } from '@/app/actions/journal';
import { formatCurrency } from '@/lib/utils/currency';

interface COASettingsHUDProps {
  accounts: COAAccount[];
  hasClearance: boolean;
  workspaces?: { id: string; name: string }[];
}

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const getDepth = (acc: COAAccount, allAccounts: COAAccount[]): number => {
  let depth = 0;
  let current = acc;
  while (current.parent_code) {
    depth++;
    const parent = allAccounts.find(a => a.account_code === current.parent_code);
    if (!parent || parent.account_code === current.account_code) break;
    current = parent;
  }
  return depth;
};

export function COASettingsHUD({ accounts, hasClearance, workspaces = [] }: COASettingsHUDProps) {
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
  const [formWorkspaceId, setFormWorkspaceId] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Delete State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New Features State
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [selectedAccountForJournal, setSelectedAccountForJournal] = useState<COAAccount | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isJournalLoading, setIsJournalLoading] = useState(false);

  React.useEffect(() => {
    if (selectedAccountForJournal) {
      setIsJournalLoading(true);
      getJournalEntriesForAccount(selectedAccountForJournal.account_code).then((data) => {
        setJournalEntries(data);
        setIsJournalLoading(false);
      });
    } else {
      setJournalEntries([]);
    }
  }, [selectedAccountForJournal]);

  const toggleCategory = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    const newSet = new Set(collapsedCategories);
    if (newSet.has(code)) newSet.delete(code);
    else newSet.add(code);
    setCollapsedCategories(newSet);
  };

  const handleDuplicate = (acc: COAAccount) => {
    if (!hasClearance) return;
    setError(null);
    setFormId(undefined);
    setFormCode('');
    setFormName(`Copy of ${acc.account_name}`);
    setFormType(acc.account_type);
    setFormDesc(acc.description || '');
    setFormParentCode(acc.parent_code || '');
    setFormWorkspaceId(acc.workspace_id || '');
    setFormActive(acc.is_active);
    setIsFormOpen(true);
  };

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
      setFormWorkspaceId(acc.workspace_id || '');
      setFormActive(acc.is_active);
    } else {
      setFormId(undefined);
      setFormCode('');
      setFormName('');
      setFormType('Asset');
      setFormDesc('');
      setFormParentCode('');
      setFormWorkspaceId('');
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
          workspace_id: formWorkspaceId || null,
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
                <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Workspace</th>
                <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase text-right">Balance</th>
                <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Status</th>
                {hasClearance && <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d4af37]/10">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-mono text-zinc-500">
                    NO ACCOUNTS FOUND MATCHING CRITERIA.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const depth = getDepth(acc, accounts);
                  
                  let isHidden = false;
                  let current = acc;
                  while (current.parent_code) {
                    if (collapsedCategories.has(current.parent_code)) {
                      isHidden = true;
                      break;
                    }
                    const parent = accounts.find(a => a.account_code === current.parent_code);
                    if (!parent) break;
                    current = parent;
                  }
                  
                  if (isHidden) return null;

                  const isCategory = depth === 0;
                  const isCollapsed = collapsedCategories.has(acc.account_code);

                  return (
                  <tr 
                    key={acc.id} 
                    onClick={() => setSelectedAccountForJournal(acc)}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-mono font-bold text-[#f5d77f]">
                      <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 1.5}rem` }}>
                        {isCategory ? (
                          <button 
                            onClick={(e) => toggleCategory(e, acc.account_code)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="text-zinc-600">↳</span>
                        )}
                        <span>{acc.account_code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div 
                        className={`${isCategory ? 'text-base font-bold text-[#d4af37]' : 'text-sm font-medium text-white'}`}
                        style={{ paddingLeft: `${depth * 1.5}rem` }}
                      >
                        {acc.account_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-black/60 border border-zinc-800 text-[10px] font-mono text-zinc-300 uppercase w-max">
                        {acc.account_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {acc.workspace_id ? (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-[#d4af37]/10 border border-[#d4af37]/20 text-[10px] font-mono text-[#d4af37] uppercase w-max">
                          {workspaces.find(w => w.id === acc.workspace_id)?.name || 'Unknown Workspace'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-400 uppercase w-max">
                          Global
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-mono font-medium text-white">Rp 0.00</div>
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
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDuplicate(acc); }}
                              className="p-2 text-zinc-400 hover:text-white transition-colors"
                              title="Duplicate Account"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenForm(acc); }}
                              className="p-2 text-zinc-400 hover:text-white transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(acc.id!); }}
                              className="p-2 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
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
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Workspace Assignment</label>
                <select
                  value={formWorkspaceId}
                  onChange={(e) => setFormWorkspaceId(e.target.value)}
                  className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-[#f5d77f] focus:outline-none focus:border-[#d4af37]/60"
                >
                  <option value="">Global (All Workspaces)</option>
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
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
      {/* Journal Details Modal */}
      {selectedAccountForJournal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedAccountForJournal(null)}>
          <div 
            className="w-full max-w-5xl h-[80vh] flex flex-col gold-glass-panel rounded-2xl border border-[#d4af37]/30 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[#d4af37]/20 bg-black/40 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase text-[#f5d77f] flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-[#d4af37]" />
                  JOURNAL: {selectedAccountForJournal.account_name}
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-2">ACCOUNT {selectedAccountForJournal.account_code} • {selectedAccountForJournal.account_type.toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedAccountForJournal(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Table */}
            <div className="flex-1 overflow-auto bg-black/20">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0f1115] border-b border-[#d4af37]/20 z-10 shadow-md">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Description</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-[#d4af37] uppercase">Ref / Status</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-emerald-400 uppercase text-right">Cash In</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-rose-400 uppercase text-right">Cash Out</th>
                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-white uppercase text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {isJournalLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-10 h-10 text-[#d4af37] animate-spin" />
                          <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Loading Ledger...</p>
                        </div>
                      </td>
                    </tr>
                  ) : journalEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-zinc-700" />
                          </div>
                          <p className="text-sm font-mono font-bold text-zinc-500 uppercase tracking-widest">No Transactions Found</p>
                          <p className="text-xs text-zinc-600 max-w-xs mx-auto">The ledger for this account is currently empty. Transactions will appear here once recorded.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    journalEntries.map((entry) => {
                      // Note: True running balance would be calculated differently depending on Asset vs Liability,
                      // For now we just show the line amounts
                      return (
                        <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-3 text-xs font-mono text-zinc-400">
                            {new Date(entry.transaction_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 text-sm text-white">
                            {entry.description || '-'}
                          </td>
                          <td className="px-6 py-3 text-xs font-mono text-zinc-500 uppercase">
                            {entry.reference_type}
                          </td>
                          <td className="px-6 py-3 text-sm font-mono text-emerald-400 text-right">
                            {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : '-'}
                          </td>
                          <td className="px-6 py-3 text-sm font-mono text-rose-400 text-right">
                            {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : '-'}
                          </td>
                          <td className="px-6 py-3 text-sm font-mono text-zinc-300 text-right">
                            {/* Running Balance placeholder */}
                            -
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
