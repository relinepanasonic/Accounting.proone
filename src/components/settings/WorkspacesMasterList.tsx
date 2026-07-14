'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, ArrowRight, Check, Star, Shield, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { createWorkspace, switchWorkspace } from '@/app/actions/workspace';

export interface WorkspaceMasterItem {
  id: string;
  name: string;
  role: string;
  isTaxRegistered: boolean;
  taxRatePercent: number;
  logoUrl?: string;
}

interface WorkspacesMasterListProps {
  workspaces: WorkspaceMasterItem[];
  activeWorkspaceId: string;
}

export function WorkspacesMasterList({
  workspaces,
  activeWorkspaceId,
}: WorkspacesMasterListProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setErrorMsg('');
    startTransition(async () => {
      const res = await createWorkspace(newCompanyName.trim());
      if (res.success && res.workspace?.id) {
        setShowCreateModal(false);
        setNewCompanyName('');
        // Navigate directly to the newly created company's detail control panel
        router.push(`/settings/workspaces/${res.workspace.id}`);
      } else {
        setErrorMsg(res.error || 'Failed to create new enterprise tenant.');
      }
    });
  };

  const handleSwitchTenant = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (targetId === activeWorkspaceId) return;

    startTransition(async () => {
      const res = await switchWorkspace(targetId);
      if (res.success) {
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header bar with + Add New Workspace button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="text-base font-extrabold uppercase tracking-wider text-white font-serif flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#d4af37]" />
            <span>ENTERPRISE TENANT DIRECTORY ({workspaces.length})</span>
          </h2>
          <p className="text-xs text-[#d4af37] font-mono mt-1">
            SELECT A TENANT TO ACCESS ITS MASTER CONTROL PANEL OR REGISTER A NEW LEGAL ENTITY
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateModal(true);
            setErrorMsg('');
          }}
          disabled={isPending}
          className="gold-btn inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:scale-105 transition-all shrink-0"
        >
          <Plus className="w-4 h-4 text-black" />
          <span>+ ADD NEW WORKSPACE</span>
        </button>
      </div>

      {/* Inline / Modal Create Workspace Form */}
      {showCreateModal && (
        <div className="gold-glass-panel rounded-3xl p-6 sm:p-8 border border-[#d4af37]/60 shadow-[0_0_50px_rgba(212,175,55,0.2)] animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f5d77f]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
                  REGISTER NEW ENTERPRISE TENANT
                </h3>
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  ISOLATED MULTI-TENANT LEDGER & COMPANY REGISTRY • SUPERADMIN CLEARANCE
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-[#f5d77f] uppercase px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40">
              TENANT DEPLOYMENT
            </span>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2.5 p-4 mb-5 rounded-xl bg-red-950/60 border border-red-700 text-red-200 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateWorkspace} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                NEW COMPANY OR LEGAL ENTITY NAME *
              </label>
              <input
                type="text"
                placeholder="e.g. PT Pintu Langit Inovasi Global"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                disabled={isPending}
                autoFocus
                className="w-full bg-black border border-[#d4af37]/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCompanyName('');
                }}
                disabled={isPending}
                className="px-6 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono uppercase transition-colors"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isPending || !newCompanyName.trim()}
                className="gold-btn inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <Plus className="w-4 h-4 text-black" />
                )}
                <span>{isPending ? 'DEPLOYING...' : 'REGISTER & CONTROL TENANT'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Master List Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workspaces.map((ws) => {
          const isCurrent = ws.id === activeWorkspaceId;
          return (
            <div
              key={ws.id}
              onClick={() => router.push(`/settings/workspaces/${ws.id}`)}
              className={`gold-glass-panel rounded-3xl p-6 border transition-all duration-300 cursor-pointer flex flex-col justify-between group hover:border-[#d4af37] hover:shadow-[0_0_35px_rgba(212,175,55,0.25)] relative overflow-hidden ${
                isCurrent
                  ? 'border-[#d4af37]/80 bg-gradient-to-br from-[#18233c]/60 to-[#0b0c10]/90 shadow-[0_0_25px_rgba(212,175,55,0.15)]'
                  : 'border-zinc-800/80 bg-zinc-950/80 hover:bg-zinc-900/60'
              }`}
            >
              {/* Active Glow Accent */}
              {isCurrent && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
              )}

              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 font-extrabold text-base transition-transform group-hover:scale-105 ${
                        isCurrent
                          ? 'bg-gradient-to-tr from-[#18233c] to-[#0b0c10] border-[#d4af37] text-[#f5d77f]'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 group-hover:border-[#d4af37]/40 group-hover:text-[#f5d77f]'
                      }`}
                    >
                      {ws.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white truncate font-sans group-hover:text-[#f5d77f] transition-colors">
                          {ws.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#f5d77f]">
                          ROLE: {ws.role}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                            <Check className="w-3 h-3" />
                            <span>ACTIVE SESSION</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/60 border border-zinc-800/80 flex items-center justify-between text-xs font-mono my-4">
                  <span className="text-zinc-400">TAX CLEARANCE:</span>
                  <span
                    className={`font-bold ${
                      ws.isTaxRegistered ? 'text-[#f5d77f]' : 'text-zinc-500'
                    }`}
                  >
                    {ws.isTaxRegistered ? `PKP REGISTERED (${ws.taxRatePercent}%)` : 'NON-PKP (0%)'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3 mt-2">
                {!isCurrent ? (
                  <button
                    type="button"
                    onClick={(e) => handleSwitchTenant(e, ws.id)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-[#d4af37]/60 text-[10px] font-mono font-bold uppercase text-zinc-300 hover:text-[#f5d77f] transition-all"
                  >
                    SWITCH TO THIS SESSION
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    CURRENTLY ACTIVE
                  </span>
                )}

                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#d4af37] group-hover:translate-x-1 transition-transform">
                  <span>CONTROL PANEL</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
