'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Check, Loader2, ShieldCheck, Plus, AlertCircle } from 'lucide-react';
import { switchWorkspace, createWorkspace } from '@/app/actions/workspace';
import type { WorkspaceTenantInfo } from '@/lib/auth/workspace-context';

interface WorkspaceSwitcherProps {
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  activeRole: string;
  availableWorkspaces: WorkspaceTenantInfo[];
  isCollapsed?: boolean;
}

export function WorkspaceSwitcher({
  activeWorkspaceId,
  activeWorkspaceName,
  activeRole,
  availableWorkspaces,
  isCollapsed = false,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSelectWorkspace = (tenantId: string) => {
    if (tenantId === activeWorkspaceId) {
      setIsOpen(false);
      return;
    }

    setErrorMsg('');
    startTransition(async () => {
      const res = await switchWorkspace(tenantId);
      if (res.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to switch company.');
      }
    });
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setErrorMsg('');
    startTransition(async () => {
      const res = await createWorkspace(newCompanyName.trim());
      if (res.success) {
        setNewCompanyName('');
        setShowCreateForm(false);
        setIsOpen(false);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to create company.');
      }
    });
  };

  if (isCollapsed) {
    return (
      <div className="px-2 py-2 border-b border-[#d4af37]/20 flex justify-center">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-xl gold-glass-panel border border-[#d4af37]/40 flex items-center justify-center text-[#f5d77f] hover:border-[#d4af37] transition-all"
          title={`Active Tenant: ${activeWorkspaceName}`}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#f5d77f]" />
          ) : (
            <Image src="/logo (8).png" alt="PTO" width={20} height={20} className="object-contain" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-2.5 border-b border-[#d4af37]/20">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowCreateForm(false);
          setErrorMsg('');
        }}
        disabled={isPending}
        className="w-full text-left gold-glass-panel rounded-2xl p-2.5 border border-[#d4af37]/30 hover:border-[#d4af37] transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.15)] group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#18233c] to-[#0b0c10] border border-[#d4af37]/40 flex items-center justify-center shrink-0">
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#f5d77f]" />
              ) : (
                <Image src="/logo (8).png" alt="PTO" width={20} height={20} className="object-contain" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono text-[#d4af37] tracking-wider uppercase truncate">
                TENANT ENTITY
              </div>
              <div className="text-xs font-bold text-white truncate group-hover:text-[#f5d77f] transition-colors">
                {activeWorkspaceName}
              </div>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#d4af37] transition-transform duration-300 shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>

        <div className="mt-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
          <span className="font-mono text-zinc-400">CLEARANCE ROLE</span>
          <span className="font-mono font-bold text-[#f5d77f] uppercase px-2 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/40">
            {activeRole}
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-3 right-3 top-full mt-1.5 z-50 gold-glass-panel rounded-2xl border border-[#d4af37]/60 shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="px-3 py-2 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              SWITCH ENTERPRISE TENANT
            </span>
            <span className="text-[9px] font-mono text-[#d4af37]">
              {availableWorkspaces.length} COMPANY
            </span>
          </div>

          {errorMsg && (
            <div className="px-3 py-2 bg-red-950/60 border-b border-red-800 text-[10px] text-red-300 font-mono flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="max-h-52 overflow-y-auto divide-y divide-zinc-900">
            {availableWorkspaces.map((ws) => {
              const isCurrent = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelectWorkspace(ws.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-xs transition-colors ${
                    isCurrent
                      ? 'bg-[#d4af37]/15 text-[#f5d77f]'
                      : 'hover:bg-zinc-900/80 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold truncate">{ws.name}</div>
                    <div className="text-[10px] font-mono text-zinc-400 uppercase mt-0.5">
                      ROLE: {ws.role}
                    </div>
                  </div>
                  {isCurrent && <Check className="w-4 h-4 shrink-0 text-[#f5d77f]" />}
                </button>
              );
            })}
          </div>

          {/* Create Company Inline Section */}
          <div className="p-2.5 bg-zinc-950/90 border-t border-zinc-800 space-y-2">
            {!showCreateForm ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="w-full py-2 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 hover:border-[#d4af37] text-center text-[11px] font-mono font-bold uppercase text-[#f5d77f] flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>NEW COMPANY TENANT</span>
              </button>
            ) : (
              <form onSubmit={handleCreateCompany} className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g. PT Pintu Langit Inovasi"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  disabled={isPending}
                  autoFocus
                  className="w-full bg-black border border-[#d4af37]/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    disabled={isPending || !newCompanyName.trim()}
                    className="flex-1 py-1.5 rounded-xl bg-[#d4af37] text-black font-bold text-[10px] uppercase font-mono disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                  >
                    {isPending ? 'CREATING...' : 'CREATE & SWITCH'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCompanyName('');
                    }}
                    className="px-3 py-1.5 rounded-xl border border-zinc-800 text-zinc-400 text-[10px] font-mono uppercase hover:text-white"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowCreateForm(false);
              }}
              className="w-full py-1 text-center text-[10px] font-mono uppercase text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              CLOSE MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
