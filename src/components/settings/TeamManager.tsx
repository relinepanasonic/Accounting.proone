'use client';

import React, { useState, useTransition } from 'react';
import { UserPlus, ShieldAlert, ShieldCheck, Loader2, AlertCircle, Check, Trash2, Edit2, X, Save, Copy, Link2 } from 'lucide-react';
import { createInvite, revokeInvite } from '@/app/actions/invite';
import Link from 'next/link';
import { deleteTeamMember, updateTeamMemberAccess } from '@/app/actions/settings';

export interface TeamMemberRecord {
  id: string;
  email: string;
  name?: string;
  role: 'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'sales' | 'client' | 'founder';
  isCurrentUser?: boolean;
  workspaceIds?: string[];
}

interface TeamManagerProps {
  initialMembers: TeamMemberRecord[];
  currentUserRole: string;
  workspaces: { id: string; name: string }[];
  activeWorkspaceId: string;
  pendingInvites?: PendingInvite[];
}

export interface PendingInvite {
  id: string;
  fullName: string;
  role: string;
  expiresAt: string;
  workspaceIds: string[];
}

export function TeamManager({ initialMembers, currentUserRole, workspaces, activeWorkspaceId, pendingInvites = [] }: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMemberRecord[]>(initialMembers);
  const [name, setName] = useState('');
  const [pending, setPending] = useState<PendingInvite[]>(pendingInvites);
  const [role, setRole] = useState<'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'sales' | 'client'>('accounting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'sales' | 'client' | 'founder'>('accounting');
  const [isPending, startTransition] = useTransition();
  // Workspaces a new member can enter (default: the current one) and, while editing, an existing member's.
  const [inviteWorkspaceIds, setInviteWorkspaceIds] = useState<string[]>([activeWorkspaceId]);
  const [editWorkspaceIds, setEditWorkspaceIds] = useState<string[]>([]);
  const workspaceName = (id: string) => workspaces.find((w) => w.id === id)?.name || 'Workspace';
  const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleDelete = (id: string) => {
    if (!confirm('Remove this person?\n\nIf this is the only workspace they belong to, their login is deleted completely, so the same email can be invited again as a new person.')) return;
    
    startTransition(async () => {
      try {
        const res = await deleteTeamMember({ memberId: id });
        if (res.success) {
          setMembers((prev) => prev.filter((m) => m.id !== id));
          if ('loginError' in res && res.loginError) {
            setErrorMsg(`Removed from this workspace, but the login could not be deleted: ${res.loginError}`);
          } else if ('loginDeleted' in res && res.loginDeleted) {
            setSuccessMsg('Member removed and their login deleted. That email can be invited again.');
            setInviteLink(null);
          }
        } else {
          setErrorMsg(res.error || 'Failed to remove member.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error removing member.');
      }
    });
  };

  const handleUpdateRole = (id: string) => {
    startTransition(async () => {
      try {
        const res = await updateTeamMemberAccess({
          memberId: id,
          role: editRole as 'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'sales' | 'client',
          workspaceIds: editWorkspaceIds,
        });
        if (res.success) {
          if ('removedFromCurrent' in res && res.removedFromCurrent) {
            // No longer a member of this workspace: drop them from this list.
            setMembers((prev) => prev.filter((m) => m.id !== id));
          } else {
            setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: editRole, workspaceIds: editWorkspaceIds } : m)));
          }
          setEditingId(null);
        } else {
          setErrorMsg(res.error || 'Failed to update access.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error updating access.');
      }
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setInviteLink(null);
    setLinkCopied(false);

    startTransition(async () => {
      try {
        const res = await createInvite({ fullName: name, role, workspaceIds: inviteWorkspaceIds });

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create the invitation.');
        } else {
          if (res.inviteId && res.expiresAt) {
            setPending((prev) => [
              { id: res.inviteId!, fullName: name.trim(), role, expiresAt: res.expiresAt!, workspaceIds: inviteWorkspaceIds },
              ...prev,
            ]);
          }
          setInviteLink(res.link || null);
          setSuccessMsg(`Invitation ready for ${name.trim()}. Send them this link: it works once and expires in 7 days. They enter their own email, phone, username and password.`);
          setName('');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Error creating the invitation');
      }
    });
  };

  const handleRevokeInvite = (id: string) => {
    if (!confirm('Cancel this invitation? The link will stop working.')) return;
    startTransition(async () => {
      const res = await revokeInvite(id);
      if (res.success) setPending((prev) => prev.filter((i) => i.id !== id));
      else setErrorMsg(res.error || 'Could not cancel the invitation.');
    });
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'founder':
        return 'bg-[#d4af37]/30 border-[#d4af37] text-[#f5d77f] font-extrabold shadow-[0_0_10px_rgba(212,175,55,0.3)]';
      case 'superadmin':
        return 'bg-[#d4af37]/20 border-[#d4af37] text-[#f5d77f]';
      case 'accounting':
        return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-300';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Invite Member Form */}
      <form
        onSubmit={handleInvite}
        className="gold-glass-panel rounded-3xl p-6 space-y-4 lg:col-span-1 h-fit"
      >
        <div className="border-b border-[#d4af37]/20 pb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#d4af37]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            GRANT WORKSPACE CLEARANCE
          </h3>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/60 text-[#f5d77f] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs flex flex-col gap-3">
            <div className="flex items-start gap-2 font-mono">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
            {inviteLink && (
              <div className="bg-black/40 p-2.5 rounded-xl border border-emerald-500/20 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-mono">
                  <Link2 className="w-3 h-3" />
                  INVITE LINK
                </div>
                <code className="text-[10px] break-all text-zinc-300 leading-relaxed">{inviteLink}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 3000);
                  }}
                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 rounded-lg text-[10px] font-bold tracking-wider transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {linkCopied ? 'COPIED!' : 'COPY LINK'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              NAME *
            </label>
            <input
              type="text"
              required
              placeholder="Their name, e.g. Siska Handayani"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              ASSIGNED SAAS ROLE *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-[#f5d77f] font-mono focus:outline-none focus:border-[#d4af37]"
            >
              <option value="accounting">ACCOUNTING (Full Ledger & Invoice Rights)</option>
              <option value="advertiser">ADVERTISER (Ads Data Input, Assigned Clients Only)</option>
              <option value="sales">SALES (Leads, Pipeline, Invoice Requests; no finance)</option>
              <option value="client">CLIENT (Read-Only Ads Reports, Assigned Clients Only)</option>
              <option value="admin">ADMIN (Operations & Client Reporting)</option>
              <option value="superadmin">SUPERADMIN (Full Ownership & Settings)</option>
            </select>
          </div>

          {workspaces.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                WORKSPACES THEY CAN ENTER *
              </label>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 divide-y divide-zinc-900">
                {workspaces.map((w) => (
                  <label key={w.id} className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 cursor-pointer hover:bg-zinc-900/60">
                    <input
                      type="checkbox"
                      checked={inviteWorkspaceIds.includes(w.id)}
                      onChange={() => setInviteWorkspaceIds((list) => toggleId(list, w.id))}
                      className="accent-[#d4af37]"
                    />
                    <span className="truncate">{w.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">The role above applies in every workspace you tick.</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending || name.trim().length < 2 || inviteWorkspaceIds.length === 0}
          className="gold-btn w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Link2 className="w-4 h-4 text-black" />
          )}
          <span>{isPending ? 'GENERATING...' : 'GENERATE INVITE LINK'}</span>
        </button>
      </form>

      {/* Members List Table */}
      <div className="gold-glass-panel rounded-3xl p-6 lg:col-span-2 space-y-4">
        <div className="border-b border-[#d4af37]/20 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            ACTIVE WORKSPACE CREDENTIALS ({members.length} MEMBERS)
          </h3>
          <span className="text-[10px] font-mono text-[#f5d77f]">SUPERADMIN ACCESS CONFIRMED</span>
        </div>

        {pending.length > 0 && (
          <div className="rounded-2xl border border-[#d4af37]/25 bg-black/20">
            <div className="px-4 py-2.5 border-b border-[#d4af37]/15 text-[10px] font-bold uppercase tracking-wider text-[#f5d77f]">
              PENDING INVITATIONS ({pending.length})
            </div>
            <div className="divide-y divide-zinc-900">
              {pending.map((inv) => (
                <div key={inv.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="font-bold text-white">{inv.fullName}</span>
                  <span className="text-[10px] font-mono uppercase text-zinc-400">{inv.role}</span>
                  <span className="text-[10px] text-zinc-500">{inv.workspaceIds.map((id) => workspaceName(id)).join(', ')}</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">expires {new Date(inv.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  <button type="button" onClick={() => handleRevokeInvite(inv.id)} className="text-red-900 hover:text-red-500" title="Cancel invitation">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-3">MEMBER IDENTITY</th>
                <th className="py-3 px-3">SECURITY CLEARANCE ROLE</th>
                <th className="py-3 px-3 text-right">STATUS / ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-xs">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-white flex items-center gap-2">
                      {m.name || m.email}
                      {m.isCurrentUser && (
                        <span className="bg-[#d4af37]/20 text-[#f5d77f] text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest border border-[#d4af37]/30">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">{m.email}</div>
                    {editingId === m.id ? (
                      <div className="mt-2 space-y-1">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Can enter</div>
                        {workspaces.map((w) => (
                          <label key={w.id} className="flex items-center gap-2 text-[11px] text-zinc-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editWorkspaceIds.includes(w.id)}
                              onChange={() => setEditWorkspaceIds((list) => toggleId(list, w.id))}
                              className="accent-[#d4af37]"
                            />
                            {w.name}
                          </label>
                        ))}
                        <div className="text-[9px] text-zinc-500">Role applies here and to workspaces you add.</div>
                      </div>
                    ) : (
                      workspaces.length > 1 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(m.workspaceIds || []).map((id) => (
                            <span key={id} className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-400">
                              {workspaceName(id)}
                            </span>
                          ))}
                        </div>
                      )
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    {editingId === m.id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as any)}
                        className="bg-black/50 border border-[#d4af37]/30 text-[#f5d77f] text-[10px] rounded px-2 py-1 font-mono uppercase focus:outline-none"
                      >
                        <option value="superadmin">SUPERADMIN</option>
                        <option value="accounting">ACCOUNTING</option>
                        <option value="advertiser">ADVERTISER</option>
                        <option value="sales">SALES</option>
                        <option value="client">CLIENT</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${getRoleBadgeColor(
                          m.role
                        )}`}
                      >
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right flex items-center justify-end gap-3 h-full pt-4">
                    {editingId === m.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateRole(m.id)}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors"
                          title="Save Role"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-zinc-500 hover:text-zinc-400 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-mono text-emerald-400">ACTIVE SESSION</span>
                        {(currentUserRole === 'founder' || (currentUserRole === 'superadmin' && m.role !== 'superadmin')) && m.role !== 'founder' && !m.isCurrentUser && (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(m.id);
                                setEditRole(m.role);
                                setEditWorkspaceIds(m.workspaceIds && m.workspaceIds.length > 0 ? m.workspaceIds : [activeWorkspaceId]);
                              }}
                              className="text-[#d4af37]/60 hover:text-[#f5d77f] transition-colors ml-2"
                              title="Edit Role"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="text-red-900 hover:text-red-500 transition-colors"
                              title="Revoke Clearance"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
