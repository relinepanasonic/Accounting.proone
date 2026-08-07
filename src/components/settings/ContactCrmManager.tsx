'use client';

import React, { useState, useTransition } from 'react';
import { Plus, Users, Mail, Building2, Loader2, AlertCircle, Edit3, Trash2, X, Check, Shield } from 'lucide-react';
import { createClientRecord, updateClientRecord, deleteClientRecord } from '@/app/actions/settings';

export interface ClientRecord {
  id: string;
  name: string;
  company?: string;
  email?: string;
  contactType?: 'client' | 'vendor';
}

interface ContactCrmManagerProps {
  initialClients: ClientRecord[];
  currentUserRole?: string;
  activeWorkspaceId?: string;
  availableWorkspaces?: any[];
}

export function ContactCrmManager({ initialClients, currentUserRole, activeWorkspaceId, availableWorkspaces }: ContactCrmManagerProps) {
  const [clients, setClients] = useState<ClientRecord[]>(initialClients);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<'client' | 'vendor'>('client');
  const [contactType, setContactType] = useState<'client' | 'vendor'>('client');
  const [cloneWorkspaceIds, setCloneWorkspaceIds] = useState<string[]>([]);

  // Edit modal state
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isSuperAdmin = !currentUserRole || currentUserRole === 'superadmin' || currentUserRole === 'founder';

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await createClientRecord({
          name,
          contactPerson,
          email,
          contactType,
          cloneWorkspaceIds,
        });

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create client');
        } else {
          const newId = res.client?.id || Math.random().toString();
          setClients((prev) => [
            {
              id: newId,
              name,
              company: contactPerson || name,
              email,
              contactType,
            },
            ...prev,
          ]);
          setName('');
          setContactPerson('');
          setEmail('');
          setCloneWorkspaceIds([]);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Error creating client');
      }
    });
  };

  const handleOpenEdit = (client: ClientRecord) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditContact(client.company || '');
    setEditEmail(client.email || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editName) return;
    setEditPending(true);
    setEditError(null);

    try {
      const res = await updateClientRecord({
        id: editingClient.id,
        name: editName,
        contactPerson: editContact,
        email: editEmail,
      });

      if (!res.success) {
        setEditError(res.error || 'Failed to update client');
      } else {
        setClients((prev) =>
          prev.map((c) =>
            c.id === editingClient.id
              ? {
                  ...c,
                  name: editName,
                  company: editContact || editName,
                  email: editEmail,
                }
              : c
          )
        );
        setEditingClient(null);
      }
    } catch (err: any) {
      setEditError(err?.message || 'Error updating client');
    } finally {
      setEditPending(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    setDeletingId(clientId);
    try {
      const res = await deleteClientRecord(clientId);
      if (res.success) {
        setClients((prev) => prev.filter((c) => c.id !== clientId));
      } else {
        alert(res.error || 'Failed to delete client account');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting client');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      {/* Quick Add Client Form */}
      <form
        onSubmit={handleAddClient}
        className="gold-glass-panel rounded-3xl p-6 space-y-4 lg:col-span-1 h-fit"
      >
        <div className="border-b border-[#d4af37]/20 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#d4af37]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              ONBOARD NEW ACCOUNT
            </h3>
          </div>
          {currentUserRole && (
            <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-[#d4af37]/15 text-[#f5d77f] border border-[#d4af37]/30 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              <span>{currentUserRole}</span>
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/60 text-[#f5d77f] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              COMPANY NAME *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Nüman Kitchenware Indonesia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              PRIMARY CONTACT PERSON
            </label>
            <input
              type="text"
              placeholder="e.g. Hendra Santoso (Director)"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              BILLING EMAIL ADDRESS
            </label>
            <input
              type="email"
              placeholder="billing@numan.co.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              ACCOUNT TYPE
            </label>
            <select
              value={contactType}
              onChange={(e) => setContactType(e.target.value as 'client' | 'vendor')}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
            >
              <option value="client">Client (Piutang)</option>
              <option value="vendor">Vendor (Hutang)</option>
            </select>
          </div>
        </div>

        {availableWorkspaces && availableWorkspaces.length > 1 && (
          <div className="pt-2 border-t border-[#d4af37]/20">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-2">
              CLONE TO OTHER WORKSPACES?
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              {availableWorkspaces.filter(ws => ws.id !== activeWorkspaceId).map(ws => (
                <label key={ws.id} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">
                  <input 
                    type="checkbox" 
                    className="rounded border-zinc-700 bg-zinc-900/50 text-[#d4af37] focus:ring-[#d4af37]"
                    checked={cloneWorkspaceIds.includes(ws.id)}
                    onChange={(e) => {
                      if (e.target.checked) setCloneWorkspaceIds(prev => [...prev, ws.id]);
                      else setCloneWorkspaceIds(prev => prev.filter(id => id !== ws.id));
                    }}
                  />
                  <span className="truncate">{ws.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="gold-btn w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Plus className="w-4 h-4 text-black" />
          )}
          <span>REGISTER ACCOUNT</span>
        </button>
      </form>

      {/* Clients CRM Table */}
      <div className="gold-glass-panel rounded-3xl p-6 lg:col-span-2 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#d4af37]/20 pb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#d4af37]" />
              CLIENTS CONTACTS
            </h3>
            <p className="text-[10px] text-zinc-400 mt-1">
              Manage your clients and vendors profiles.
            </p>
          </div>
          <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button 
              type="button"
              onClick={() => setActiveTab('client')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-colors ${activeTab === 'client' ? 'bg-[#d4af37] text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              Clients
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('vendor')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-colors ${activeTab === 'vendor' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Vendors
            </button>
          </div>
        </div>

        {clients.filter(c => (c.contactType || 'client') === activeTab).length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-800/80 rounded-2xl my-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">No {activeTab}s Recorded Yet</h4>
              <p className="text-xs text-zinc-400 font-sans mt-1 max-w-md mx-auto">
                Register your contacts using the form on the left.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-3">COMPANY NAME</th>
                  <th className="py-3 px-3">CONTACT PERSON</th>
                  <th className="py-3 px-3">BILLING EMAIL</th>
                  {isSuperAdmin && <th className="py-3 px-3 text-right">ACTIONS</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {clients.filter(c => (c.contactType || 'client') === activeTab).map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/40 transition-colors group">
                    <td className="py-3.5 px-3 font-bold text-white group-hover:text-[#f5d77f] transition-colors">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-3 text-zinc-300">{c.company || '—'}</td>
                    <td className="py-3.5 px-3 font-mono text-[#f5d77f]">{c.email || '—'}</td>
                    {isSuperAdmin && (
                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            title="Edit Profile"
                            className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-[#f5d77f] hover:border-[#d4af37]/60 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === c.id}
                            onClick={() => {
                              if (confirm(`Are you sure you want to permanently delete "${c.name}"?`)) {
                                handleDelete(c.id);
                              }
                            }}
                            title="Delete Client Profile"
                            className="p-1.5 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 hover:text-red-300 hover:border-red-600 transition-all disabled:opacity-50"
                          >
                            {deletingId === c.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Luxury Frosted Gold Edit Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="gold-glass-panel rounded-3xl p-6 max-w-md w-full border border-[#d4af37]/60 shadow-[0_0_50px_rgba(212,175,55,0.25)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#f5d77f]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  EDIT CLIENT CONTACT PROFILE
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/60 text-[#f5d77f] text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  COMPANY NAME *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  PRIMARY CONTACT PERSON
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hendra Santoso (Director)"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  BILLING EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  placeholder="billing@company.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  className="gold-btn inline-flex items-center gap-2 px-6 py-2 rounded-full text-xs font-extrabold uppercase tracking-wider disabled:opacity-50 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                >
                  {editPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-black" />
                  )}
                  <span>SAVE CHANGES</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
