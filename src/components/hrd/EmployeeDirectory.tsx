'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Pencil, Trash2, Copy, Check, Link2, SlidersHorizontal, Home, CalendarOff, AlertTriangle, Hash } from 'lucide-react';
import { createInvite, revokeInvite } from '@/app/actions/invite';
import { deleteTeamMember, updateTeamMemberAccess } from '@/app/actions/settings';
import { setEmploymentStatus } from '@/app/actions/employees';
import { autoGenerateStaffIds } from '@/app/actions/hrd';
import { SortArrows } from '@/components/ui/SortArrows';
import { EmployeeProfileDrawer } from '@/components/hrd/EmployeeProfileDrawer';
import { formatRp, WFH_DAY_OPTIONS, type EmployeeProfileData } from '@/lib/hrd/types';

export type Status = 'tetap' | 'freelance' | null;
export interface Person {
  memberId: string | null;
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: Status;
  since: string | null;
  workspaceIds: string[];
  isCurrentUser: boolean;
  profile: EmployeeProfileData;
}
export interface PendingEmployeeInvite { id: string; fullName: string; role: string; expiresAt: string; workspaceIds: string[] }

const ROLE_LABEL: Record<string, string> = { founder: 'Founder', superadmin: 'Superadmin', accounting: 'Accounting', admin: 'Admin', advertiser: 'Advertiser', sales: 'Sales', client: 'Client' };
const ROLE_CHOICES = ['accounting', 'admin', 'advertiser', 'sales', 'superadmin'] as const;
const STATUS_LABEL: Record<string, string> = { tetap: 'Tetap', freelance: 'Freelance' };
const STATUS_STYLE: Record<string, string> = {
  tetap: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  freelance: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};
const since = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const input = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-400';

function StatusPicker({ person, canSet }: { person: Person; canSet: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState<Status>(person.status);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  React.useEffect(() => setValue(person.status), [person.status]);
  if (!person.memberId || !canSet) {
    return value ? <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[value]}`}>{STATUS_LABEL[value]}</span> : <span className="text-zinc-600">-</span>;
  }
  const change = (next: Status) => {
    const before = value;
    setValue(next); setError('');
    start(async () => {
      const res = await setEmploymentStatus(person.memberId!, next);
      if (!res.success) { setValue(before); setError(res.error || 'Could not save.'); return; }
      router.refresh();
    });
  };
  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => change((e.target.value || null) as Status)}
        disabled={pending}
        aria-label={`Employment status of ${person.name}`}
        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold focus:outline-none ${value ? STATUS_STYLE[value] : 'border-dashed border-zinc-600 bg-transparent text-zinc-400'} ${pending ? 'opacity-60' : ''}`}
      >
        <option value="">Set status</option>
        <option value="tetap">Tetap</option>
        <option value="freelance">Freelance</option>
      </select>
      {error && <div className="mt-1 max-w-[180px] text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

/** Companies the person can enter: tick several for one employee who works in more than one company. */
function CompanyChoices({ companies, selected, onChange }: { companies: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="divide-y divide-zinc-900 rounded-xl border border-zinc-800 bg-zinc-950">
      {companies.map((w) => (
        <label key={w.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60">
          <input type="checkbox" checked={selected.includes(w.id)} onChange={() => onChange(toggle(selected, w.id))} className="accent-[#d4af37]" />
          <span className="truncate">{w.name}</span>
        </label>
      ))}
    </div>
  );
}

function AddEmployee({ companies, activeWorkspaceId, onClose }: { companies: { id: string; name: string }[]; activeWorkspaceId: string; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('advertiser');
  const [status, setStatus] = useState<'tetap' | 'freelance'>('tetap');
  const [ids, setIds] = useState<string[]>([activeWorkspaceId]);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () => {
    setError('');
    start(async () => {
      const res = await createInvite({ fullName: name, role, workspaceIds: ids, employmentStatus: status });
      if (!res.success) { setError(res.error || 'Could not create the invitation.'); return; }
      setLink(res.link || '');
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !pending && onClose()}>
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-6" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-extrabold text-white">Add employee</h3>
          <p className="mt-1 text-xs text-zinc-500">They become a user of the company. You get a one-time link to send them; they fill in their own email, phone, username and password.</p>
        </div>
        {link ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">Invitation ready for <b>{name.trim()}</b>. The link works once and expires in 7 days.</div>
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-black/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-300"><Link2 className="h-3 w-3" /> INVITE LINK</div>
              <code className="break-all text-[11px] leading-relaxed text-zinc-300">{link}</code>
              <button type="button" onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/35">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f]">Done</button></div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <label className={label}>Name *<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Siska Handayani" autoFocus className={`${input} mt-1 normal-case`} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>Role *
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={`${input} mt-1 normal-case`}>
                    {ROLE_CHOICES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </label>
                <label className={label}>Status (tax) *
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'tetap' | 'freelance')} className={`${input} mt-1 normal-case`}>
                    <option value="tetap">Tetap</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </label>
              </div>
              <div>
                <div className={`${label} mb-1`}>Companies they can enter *</div>
                <CompanyChoices companies={companies} selected={ids} onChange={setIds} />
                <p className="mt-1 text-[10px] text-zinc-500">Tick more than one if this person works in several companies. The role and status apply in each.</p>
              </div>
            </div>
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-300">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
              <button type="button" disabled={pending || name.trim().length < 2 || ids.length === 0} onClick={create} className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40">{pending ? 'Creating...' : 'Create invite link'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditPerson({ person, companies, onClose }: { person: Person; companies: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [role, setRole] = useState(person.role);
  const [status, setStatus] = useState<Status>(person.status);
  const [ids, setIds] = useState<string[]>(person.workspaceIds);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const save = () => {
    setError('');
    start(async () => {
      const res = await updateTeamMemberAccess({ memberId: person.memberId!, role: role as any, workspaceIds: ids });
      if (!res.success) { setError(res.error || 'Could not save.'); return; }
      if (status !== person.status && !('removedFromCurrent' in res && res.removedFromCurrent)) {
        const st = await setEmploymentStatus(person.memberId!, status);
        if (!st.success) { setError(st.error || 'Saved the access, but not the status.'); router.refresh(); return; }
      }
      onClose(); router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !pending && onClose()}>
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-6" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-extrabold text-white">{person.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">{person.email}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Role
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`${input} mt-1 normal-case`}>
              {ROLE_CHOICES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <label className={label}>Status (tax)
            <select value={status || ''} onChange={(e) => setStatus((e.target.value || null) as Status)} className={`${input} mt-1 normal-case`}>
              <option value="">Not set</option>
              <option value="tetap">Tetap</option>
              <option value="freelance">Freelance</option>
            </select>
          </label>
        </div>
        <div>
          <div className={`${label} mb-1`}>Companies they can enter</div>
          <CompanyChoices companies={companies} selected={ids} onChange={setIds} />
          <p className="mt-1 text-[10px] text-zinc-500">Untick all but one to keep them in one company only. The role applies here and in the companies you add.</p>
        </div>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-300">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
          <button type="button" disabled={pending || ids.length === 0} onClick={save} className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40">{pending ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

type SortKey = 'name' | 'role' | 'status' | 'phone' | 'since';

export function EmployeeDirectory({ people, companies, activeWorkspaceId, currentUserRole, canManage, canSetStatus, canEditHrProfile, migrationRequired, pendingInvites }: {
  people: Person[]; companies: { id: string; name: string }[]; activeWorkspaceId: string; currentUserRole: string; canManage: boolean; canSetStatus: boolean; canEditHrProfile: boolean; migrationRequired?: boolean; pendingInvites: PendingEmployeeInvite[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'tetap' | 'freelance' | 'wfh' | 'cuti' | 'unset'>('all');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [profilePerson, setProfilePerson] = useState<Person | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name || 'Company';
  const wfhShort = (key: string) => WFH_DAY_OPTIONS.find((d) => d.key === key)?.short || key;
  const q = search.trim().toLowerCase();

  const counts = useMemo(() => ({
    all: people.length,
    tetap: people.filter((p) => p.status === 'tetap').length,
    freelance: people.filter((p) => p.status === 'freelance').length,
    wfh: people.filter((p) => p.profile.wfhApproved).length,
    cuti: people.filter((p) => p.profile.cutiEligible).length,
    unset: people.filter((p) => !p.status && p.memberId).length,
  }), [people]);

  const shown = useMemo(() => {
    const list = people.filter((p) => {
      if (filter === 'tetap' && p.status !== 'tetap') return false;
      if (filter === 'freelance' && p.status !== 'freelance') return false;
      if (filter === 'wfh' && !p.profile.wfhApproved) return false;
      if (filter === 'cuti' && !p.profile.cutiEligible) return false;
      if (filter === 'unset' && (p.status || !p.memberId)) return false;
      return !q || [p.name, p.email, p.phone, p.profile.jobTitle, p.profile.department, ROLE_LABEL[p.role] || p.role].some((t) => (t || '').toLowerCase().includes(q));
    });
    const val = (p: Person) => (sort.key === 'name' ? p.name.toLowerCase() : sort.key === 'role' ? p.role : sort.key === 'status' ? p.status || 'zzz' : sort.key === 'phone' ? p.phone : p.since || '');
    return list.sort((a, b) => val(a).localeCompare(val(b), 'id', { numeric: true }) * (sort.asc ? 1 : -1));
  }, [people, filter, q, sort]);

  const mayEdit = (p: Person) => canManage && !!p.memberId && p.role !== 'founder' && !p.isCurrentUser && (currentUserRole === 'founder' || p.role !== 'superadmin');
  const remove = (p: Person) => {
    if (!window.confirm(`Remove ${p.name}?\n\nIf this is the only company they belong to, their login is deleted completely, so the same email can be invited again as a new person.`)) return;
    setError('');
    start(async () => {
      const res = await deleteTeamMember({ memberId: p.memberId! });
      if (!res.success) setError(res.error || 'Could not remove.'); else router.refresh();
    });
  };
  const cancelInvite = (id: string) => {
    if (!window.confirm('Cancel this invitation? The link will stop working.')) return;
    start(async () => {
      const res = await revokeInvite(id);
      if (!res.success) setError(res.error || 'Could not cancel the invitation.'); else router.refresh();
    });
  };

  const missingStaffIds = useMemo(() => people.filter((p) => !p.profile.employeeCode && p.role !== 'founder').length, [people]);
  const handleGenerateIds = () => {
    setError('');
    start(async () => {
      const res = await autoGenerateStaffIds();
      if (!res.success) setError(res.error || 'Could not generate Staff IDs.');
      else router.refresh();
    });
  };

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-4 py-3 font-bold">
      <button onClick={() => setSort((p) => (p.key === k ? { key: k, asc: !p.asc } : { key: k, asc: true }))} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${sort.key === k ? 'text-[#f5d77f]' : ''}`}>
        {children}<SortArrows dir={sort.key === k ? (sort.asc ? 'asc' : 'desc') : null} />
      </button>
    </th>
  );
  const pill = (k: typeof filter, text: string) => (
    <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === k ? 'border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f5d77f]' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
      {text} <span className="ml-1 font-mono text-[10px] opacity-70">{counts[k]}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {migrationRequired && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <b>HRD Database Migration Needed:</b> Run <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px]">supabase/migrations/20261213_hrd_core.sql</code> in Supabase SQL Editor to enable HR Profiles (Annual Cuti BOD ACC, WFH Days, Shifts, Salary) as well as Cuti and Kasbon.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, job title or role" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/50 focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">{pill('all', 'All')}{pill('tetap', 'Tetap')}{pill('freelance', 'Freelance')}{pill('cuti', 'Cuti ACC')}{pill('wfh', 'WFH ACC')}{pill('unset', 'Status not set')}</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEditHrProfile && missingStaffIds > 0 && (
            <button type="button" disabled={pending} onClick={handleGenerateIds} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50">
              <Hash className="h-3.5 w-3.5" /> Auto-Generate Staff IDs ({missingStaffIds})
            </button>
          )}
          {canManage && <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3.5 py-2 text-xs font-bold text-[#f5d77f] hover:brightness-125"><Plus className="h-4 w-4" /> Add employee</button>}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-300">{error}</div>}

      {pendingInvites.length > 0 && (
        <div className="rounded-2xl border border-[#d4af37]/25 bg-black/20">
          <div className="border-b border-[#d4af37]/15 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#f5d77f]">Invited, not joined yet ({pendingInvites.length})</div>
          <div className="divide-y divide-zinc-900">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
                <span className="font-bold text-white">{inv.fullName}</span>
                <span className="text-[10px] font-bold uppercase text-zinc-400">{ROLE_LABEL[inv.role] || inv.role}</span>
                <span className="text-[10px] text-zinc-500">{inv.workspaceIds.map(companyName).join(', ')}</span>
                <span className="ml-auto text-[10px] text-zinc-600">expires {new Date(inv.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                {canManage && <button type="button" disabled={pending} onClick={() => cancelInvite(inv.id)} className="text-red-900 hover:text-red-500" title="Cancel the invitation"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full min-w-[1260px] text-left text-sm">
          <thead className="border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Staff ID</th>
              <Th k="name">Employee</Th><Th k="role">Role</Th><Th k="status">Status (tax)</Th>
              {canEditHrProfile && <th className="px-4 py-3 font-bold uppercase tracking-wider">Gaji / Tunjangan / Komisi</th>}
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Cuti (BOD ACC)</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">WFH &amp; Shift</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Companies</th>
              <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {shown.length === 0 && <tr><td colSpan={canEditHrProfile ? 9 : 8} className="p-10 text-center text-sm text-zinc-500">No one matches.</td></tr>}
            {shown.map((p) => (
              <tr key={p.userId} className="align-top transition-colors hover:bg-[#d4af37]/[0.04]">
                <td className="px-4 py-3">
                  {p.profile.employeeCode ? (
                    <span className="inline-flex rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#f5d77f]">
                      {p.profile.employeeCode}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setProfilePerson(p)} className="group text-left">
                    <div className="flex items-center gap-2 font-bold text-zinc-100 group-hover:text-[#f5d77f]">
                      {p.name}
                      {p.isCurrentUser && <span className="rounded border border-[#d4af37]/30 bg-[#d4af37]/20 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[#f5d77f]">You</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {p.profile.jobTitle ? `${p.profile.jobTitle}${p.profile.department ? ` · ${p.profile.department}` : ''}` : (p.email || '-')}
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3"><span className="rounded-full border border-[#d4af37]/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f5d77f]">{ROLE_LABEL[p.role] || p.role}</span></td>
                <td className="px-4 py-3"><StatusPicker person={p} canSet={canSetStatus} /></td>
                {canEditHrProfile && (
                  <td className="px-4 py-3">
                    {p.profile.baseSalary > 0 || p.profile.allowances > 0 || p.profile.commissionRate > 0 ? (
                      <div className="space-y-0.5 font-mono text-[11px]">
                        <div className="font-bold text-zinc-100">{formatRp(p.profile.baseSalary)}</div>
                        <div className="text-[10px] text-zinc-400">
                          Tunj: {formatRp(p.profile.allowances)} · <span className="text-[#f5d77f]">Komisi {p.profile.commissionRate}%</span>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setProfilePerson(p)} className="text-[11px] text-amber-400/80 underline hover:text-amber-300">
                        Isi Gaji / Komisi
                      </button>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  {p.profile.cutiEligible ? (
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        <CalendarOff className="h-3 w-3" /> ACC · {p.profile.annualCutiQuota}d/yr
                      </span>
                      {p.profile.cutiApprovedBy && <div className="text-[10px] text-zinc-500">by {p.profile.cutiApprovedBy}</div>}
                    </div>
                  ) : (
                    <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-500">Belum ACC</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {p.profile.wfhApproved ? (
                      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                        <Home className="h-3 w-3" />
                        <span>WFH: {p.profile.wfhDays.length > 0 ? p.profile.wfhDays.map(wfhShort).join(', ') : 'Hari belum dipilih'}</span>
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-500">WFO Only</span>
                    )}
                    <div className="text-[10px] font-mono text-zinc-500">
                      {p.profile.workStartTime}–{p.profile.workEndTime}{p.profile.satHalfDay ? ` · Sab ${p.profile.satWorkStart}–${p.profile.satWorkEnd}` : ''}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.workspaceIds.map((id) => <span key={id} className={`rounded border px-1.5 py-0.5 text-[10px] ${id === activeWorkspaceId ? 'border-[#d4af37]/40 text-[#f5d77f]' : 'border-zinc-700 text-zinc-400'}`}>{companyName(id)}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setProfilePerson(p)}
                      title="Open HR Profile (Cuti ACC, WFH, Shift, Salary, Bank)"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/20"
                    >
                      <SlidersHorizontal className="h-3 w-3" /> HR Profile
                    </button>
                    {mayEdit(p) && (
                      <>
                        <button type="button" onClick={() => setEditing(p)} title="Edit role, status and companies" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={pending} onClick={() => remove(p)} title="Remove from the company" className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500">{shown.length} of {people.length} · Click any employee or <b>HR Profile</b> to manage BOD ACC (Annual Cuti &amp; WFH Days), Saturday half-day shift, Salary, Bank &amp; Kasbon Limit.</p>

      {adding && <AddEmployee companies={companies} activeWorkspaceId={activeWorkspaceId} onClose={() => setAdding(false)} />}
      {editing && <EditPerson person={editing} companies={companies} onClose={() => setEditing(null)} />}
      {profilePerson && <EmployeeProfileDrawer person={profilePerson} canEdit={canEditHrProfile} onClose={() => setProfilePerson(null)} />}
    </div>
  );
}
