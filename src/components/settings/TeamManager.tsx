'use client';

import React, { useState, useTransition } from 'react';
import { UserPlus, ShieldAlert, ShieldCheck, Loader2, AlertCircle, Check, Trash2, Edit2, X, Save } from 'lucide-react';
import { inviteTeamMember, deleteTeamMember, updateTeamMemberRole } from '@/app/actions/settings';

export interface TeamMemberRecord {
  id: string;
  email: string;
  name?: string;
  role: 'superadmin' | 'accounting' | 'admin';
  isCurrentUser?: boolean;
}

interface TeamManagerProps {
  initialMembers: TeamMemberRecord[];
  currentUserRole: string;
}

export function TeamManager({ initialMembers, currentUserRole }: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMemberRecord[]>(initialMembers);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'superadmin' | 'accounting' | 'admin'>('accounting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<'superadmin' | 'accounting' | 'admin'>('accounting');
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to revoke clearance for this member?')) return;
    
    startTransition(async () => {
      try {
        const res = await deleteTeamMember({ memberId: id });
        if (res.success) {
          setMembers((prev) => prev.filter((m) => m.id !== id));
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
        const res = await updateTeamMemberRole({ memberId: id, role: editRole });
        if (res.success) {
          setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: editRole } : m)));
          setEditingId(null);
        } else {
          setErrorMsg(res.error || 'Failed to update role.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error updating role.');
      }
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const res = await inviteTeamMember({ email, name, role });

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to invite member.');
        } else {
          setMembers((prev) => [
            {
              id: Math.random().toString(),
              email,
              name: name || email.split('@')[0],
              role,
            },
            ...prev,
          ]);
          if (res.inviteLink) {
            setInviteLink(res.inviteLink);
            setSuccessMsg(`Workspace clearance granted for ${email}. Copy the magic link below and send it to them to log in instantly!`);
          } else {
            setSuccessMsg(`Workspace clearance granted for ${email}. They can now log in using their email.`);
          }
          setEmail('');
          setName('');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Error inviting member');
      }
    });
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
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
            <div className="flex items-center gap-2 font-mono">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            {inviteLink && (
              <div className="bg-emerald-950/50 p-2 rounded-lg border border-emerald-500/20 flex items-center justify-between gap-2">
                <code className="text-[10px] break-all truncate">{inviteLink}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    alert('Link copied to clipboard!');
                  }}
                  className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[10px] font-bold tracking-wider transition-colors shrink-0"
                >
                  COPY LINK
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              STAFF / MEMBER EMAIL *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. finance@professortokoonline.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              FULL NAME / TITLE
            </label>
            <input
              type="text"
              placeholder="e.g. Siska Handayani (Accounting Lead)"
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
              <option value="admin">ADMIN (Operations & Payroll Overview)</option>
              <option value="superadmin">SUPERADMIN (Full Ownership & Settings)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="gold-btn w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-black" />
          )}
          <span>INVITE STAFF MEMBER</span>
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
                        {currentUserRole === 'superadmin' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(m.id);
                                setEditRole(m.role);
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
