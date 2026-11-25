'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  CalendarOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { cancelLeaveRequest, reviewLeaveRequest, submitLeaveRequest } from '@/app/actions/hrd';
import {
  calculateWorkdays,
  LEAVE_TYPE_META,
  WFH_DAY_OPTIONS,
  type HalfDayOption,
  type LeaveStatus,
  type LeaveType,
  type WeekdayKey,
} from '@/lib/hrd/types';

export interface LeaveRow {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: HalfDayOption;
  daysCount: number;
  reason: string;
  attachmentUrl: string;
  status: LeaveStatus;
  reviewedByName: string;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
}

export interface StaffQuotaRow {
  userId: string;
  name: string;
  department: string;
  cutiEligible: boolean;
  cutiApprovedBy: string;
  annualQuota: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  wfhApproved: boolean;
  wfhDays: WeekdayKey[];
  satHalfDay: boolean;
}

const STATUS_BADGE: Record<LeaveStatus, string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-red-500/40 bg-red-500/10 text-red-300',
  cancelled: 'border-zinc-700 bg-zinc-900 text-zinc-400',
};

const inputCls =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none [color-scheme:dark]';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-400';

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

const wfhShort = (key: WeekdayKey) => WFH_DAY_OPTIONS.find((d) => d.key === key)?.short || key;

function RequestLeaveModal({
  myQuota,
  onClose,
}: {
  myQuota: StaffQuotaRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [leaveType, setLeaveType] = useState<LeaveType>(myQuota.cutiEligible ? 'tahunan' : 'izin');
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [halfDay, setHalfDay] = useState<HalfDayOption>('none');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const isSingleDay = startDate === endDate;
  const days = useMemo(
    () => calculateWorkdays(startDate, endDate, isSingleDay ? halfDay : 'none', myQuota.satHalfDay),
    [startDate, endDate, halfDay, isSingleDay, myQuota.satHalfDay]
  );

  const handleSubmit = () => {
    setError('');
    start(async () => {
      const res = await submitLeaveRequest({
        leaveType,
        startDate,
        endDate,
        halfDay: isSingleDay ? halfDay : 'none',
        reason,
        attachmentUrl,
      });
      if (!res.success) {
        setError(res.error || 'Could not submit leave request.');
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => !pending && onClose()}>
      <div
        className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-extrabold text-white">Ajukan Cuti / Izin</h3>
            <p className="text-xs text-zinc-500">
              Minggu libur · {myQuota.satHalfDay ? 'Sabtu dihitung 0.5 hari (half-day)' : 'Sabtu full day'}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className={`${labelCls} mb-1.5`}>Jenis Cuti</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(LEAVE_TYPE_META) as LeaveType[]).map((t) => {
                const meta = LEAVE_TYPE_META[t];
                const locked = t === 'tahunan' && !myQuota.cutiEligible;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={locked}
                    onClick={() => setLeaveType(t)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                      leaveType === t
                        ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f5d77f]'
                        : locked
                          ? 'cursor-not-allowed border-zinc-900 bg-zinc-950/40 text-zinc-600'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-bold">{meta.label}</div>
                    {locked && <div className="text-[10px] text-amber-500/80">Butuh BOD ACC</div>}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">{LEAVE_TYPE_META[leaveType].desc}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Dari Tanggal
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className={labelCls}>
              Sampai Tanggal
              <input
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>

          {isSingleDay && (
            <label className={labelCls}>
              Durasi Hari
              <select value={halfDay} onChange={(e) => setHalfDay(e.target.value as HalfDayOption)} className={`${inputCls} mt-1`}>
                <option value="none">Full Day (1 hari / Sabtu 0.5 hari)</option>
                <option value="am">Half Day — Pagi (0.5 hari)</option>
                <option value="pm">Half Day — Siang (0.5 hari)</option>
              </select>
            </label>
          )}

          <div className="flex items-center justify-between rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/5 px-4 py-2.5 text-xs">
            <span className="text-zinc-300">Total Hari Kerja Dihitung</span>
            <span className="font-mono text-base font-extrabold text-[#f5d77f]">{days} hari</span>
          </div>

          <label className={labelCls}>
            Alasan *
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan keperluan cuti / izin Anda..."
              className={`${inputCls} mt-1 normal-case`}
            />
          </label>

          {leaveType === 'sakit' && (
            <label className={labelCls}>
              Link Surat Dokter (Google Drive / Foto — opsional)
              <input
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className={`${inputCls} mt-1 normal-case`}
              />
            </label>
          )}
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" disabled={pending} onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">
            Batal
          </button>
          <button
            type="button"
            disabled={pending || days <= 0 || reason.trim().length < 3}
            onClick={handleSubmit}
            className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40"
          >
            {pending ? 'Mengirim...' : 'Kirim Pengajuan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CutiBoard({
  leaves,
  staffQuotas,
  myQuota,
  currentUserId,
  isBod,
  migrationRequired,
}: {
  leaves: LeaveRow[];
  staffQuotas: StaffQuotaRow[];
  myQuota: StaffQuotaRow;
  currentUserId: string;
  isBod: boolean;
  migrationRequired: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'requests' | 'calendar' | 'quotas'>('requests');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'mine'>('all');
  const [showModal, setShowModal] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const visibleLeaves = useMemo(() => (isBod ? leaves : leaves.filter((l) => l.userId === currentUserId)), [leaves, isBod, currentUserId]);

  const filteredLeaves = useMemo(() => {
    return visibleLeaves.filter((l) => {
      if (statusFilter === 'mine') return l.userId === currentUserId;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      return true;
    });
  }, [visibleLeaves, statusFilter, currentUserId]);

  const pendingCount = visibleLeaves.filter((l) => l.status === 'pending').length;
  const onLeaveToday = leaves.filter((l) => l.status === 'approved' && l.startDate <= todayIso && l.endDate >= todayIso);

  const findConflicts = (req: LeaveRow) =>
    leaves.filter(
      (o) =>
        o.id !== req.id &&
        o.userId !== req.userId &&
        o.status === 'approved' &&
        o.startDate <= req.endDate &&
        o.endDate >= req.startDate
    );

  const handleReview = (id: string, decision: 'approved' | 'rejected') => {
    const note =
      decision === 'rejected' ? window.prompt('Alasan penolakan (opsional):') || '' : '';
    setError('');
    start(async () => {
      const res = await reviewLeaveRequest(id, decision, note);
      if (!res.success) setError(res.error || 'Failed to update.');
      else router.refresh();
    });
  };

  const handleCancel = (id: string) => {
    if (!window.confirm('Batalkan pengajuan cuti ini?')) return;
    setError('');
    start(async () => {
      const res = await cancelLeaveRequest(id);
      if (!res.success) setError(res.error || 'Failed to cancel.');
      else router.refresh();
    });
  };

  // Calendar calculation
  const [calYear, calMon] = calMonth.split('-').map(Number);
  const firstDayOfMonth = new Date(Date.UTC(calYear, calMon - 1, 1));
  const daysInMonth = new Date(Date.UTC(calYear, calMon, 0)).getUTCDate();
  const startOffset = (firstDayOfMonth.getUTCDay() + 6) % 7; // Monday = 0
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(calYear, calMon - 1 + delta, 1));
    setCalMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-6">
      {migrationRequired && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <b>HRD Database Migration Needed:</b> Run <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px]">supabase/migrations/20261213_hrd_core.sql</code> in Supabase SQL Editor first.
          </div>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>Cuti Tahunan Saya</span>
            <CalendarOff className="h-4 w-4 text-emerald-400" />
          </div>
          {myQuota.cutiEligible ? (
            <>
              <div className="mt-2 text-2xl font-extrabold text-emerald-300">
                {myQuota.remainingDays} <span className="text-sm font-normal text-zinc-500">/ {myQuota.annualQuota} hari</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Terpakai {myQuota.usedDays} · Pending {myQuota.pendingDays}
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-lg font-extrabold text-amber-300">Belum BOD ACC</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {isBod ? (
                  <Link href="/hrd/employees" className="text-[#f5d77f] underline">Aktifkan di Employee Directory →</Link>
                ) : (
                  'Menunggu ACC Nico / Herlan / Lucy'
                )}
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>Status WFH Saya</span>
            <Home className="h-4 w-4 text-purple-400" />
          </div>
          {myQuota.wfhApproved ? (
            <>
              <div className="mt-2 text-lg font-extrabold text-purple-300">
                {myQuota.wfhDays.length > 0 ? myQuota.wfhDays.map(wfhShort).join(', ') : 'Approved'}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">WFH ACC by BOD</div>
            </>
          ) : (
            <>
              <div className="mt-2 text-lg font-extrabold text-zinc-200">WFO Only</div>
              <div className="mt-1 text-[11px] text-zinc-500">Sabtu {myQuota.satHalfDay ? 'Half-Day (0.5d)' : 'Full Day'}</div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>{isBod ? 'Pending Approval' : 'Pengajuan Pending'}</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className={`mt-2 text-2xl font-extrabold ${pendingCount > 0 ? 'text-amber-300' : 'text-zinc-100'}`}>
            {pendingCount}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">{isBod ? 'Menunggu keputusan BOD' : 'Menunggu persetujuan'}</div>
        </div>

        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>Cuti Hari Ini</span>
            <Users className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-sky-300">{onLeaveToday.length}</div>
          <div className="mt-1 truncate text-[11px] text-zinc-500">
            {onLeaveToday.length > 0 ? onLeaveToday.map((l) => l.employeeName).join(', ') : 'Semua tim hadir hari ini'}
          </div>
        </div>
      </div>

      {/* Tabs + Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${tab === 'requests' ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#f5d77f]' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Pengajuan ({visibleLeaves.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('calendar')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${tab === 'calendar' ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#f5d77f]' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Calendar className="h-3.5 w-3.5" /> Team Calendar
          </button>
          {isBod && (
            <button
              type="button"
              onClick={() => setTab('quotas')}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${tab === 'quotas' ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#f5d77f]' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Kuota &amp; WFH Tim ({staffQuotas.length})
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f]"
        >
          <Plus className="h-4 w-4" /> Ajukan Cuti / Izin
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}

      {/* TAB 1: Requests */}
      {tab === 'requests' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'Semua'],
                ['pending', 'Pending'],
                ['approved', 'Approved'],
                ['rejected', 'Rejected'],
                ...(isBod ? [['mine', 'Pengajuan Saya']] : []),
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatusFilter(k as any)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusFilter === k
                    ? 'border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f5d77f]'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Karyawan</th>
                  <th className="px-4 py-3 font-bold">Jenis</th>
                  <th className="px-4 py-3 font-bold">Tanggal &amp; Durasi</th>
                  <th className="px-4 py-3 font-bold">Alasan</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredLeaves.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-sm text-zinc-500">
                      Belum ada pengajuan cuti.
                    </td>
                  </tr>
                )}
                {filteredLeaves.map((r) => {
                  const meta = LEAVE_TYPE_META[r.leaveType] || LEAVE_TYPE_META.izin;
                  const conflicts = isBod && r.status === 'pending' ? findConflicts(r) : [];
                  return (
                    <tr key={r.id} className="align-top hover:bg-[#d4af37]/[0.03]">
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-100">{r.employeeName}</div>
                        {r.department && <div className="text-[11px] text-zinc-500">{r.department}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-200">
                          {fmtDate(r.startDate)}
                          {r.endDate !== r.startDate ? ` – ${fmtDate(r.endDate)}` : ''}
                        </div>
                        <div className="text-[11px] font-mono text-[#f5d77f]">
                          {r.daysCount} hari {r.halfDay !== 'none' ? `(${r.halfDay.toUpperCase()})` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-xs text-zinc-300">{r.reason}</div>
                        {r.attachmentUrl && (
                          <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-sky-400 underline">
                            Lihat lampiran
                          </a>
                        )}
                        {conflicts.length > 0 && (
                          <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                            Bentrok cuti dengan: {conflicts.map((c) => c.employeeName).join(', ')}
                          </div>
                        )}
                        {r.reviewNote && (
                          <div className="mt-1 text-[11px] italic text-zinc-500">Note: {r.reviewNote}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[r.status]}`}>
                          {r.status}
                        </span>
                        {r.reviewedByName && (
                          <div className="mt-1 text-[10px] text-zinc-500">by {r.reviewedByName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isBod && r.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => handleReview(r.id, 'approved')}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                              >
                                <Check className="h-3.5 w-3.5" /> ACC
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => handleReview(r.id, 'rejected')}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                              >
                                <X className="h-3.5 w-3.5" /> Tolak
                              </button>
                            </>
                          )}
                          {r.userId === currentUserId && r.status === 'pending' && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleCancel(r.id)}
                              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                            >
                              Batal
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Team Calendar */}
      {tab === 'calendar' && (
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg border border-zinc-800 p-2 text-zinc-300 hover:border-[#d4af37]/50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-serif text-lg font-extrabold text-zinc-100">
              {firstDayOfMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h3>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg border border-zinc-800 p-2 text-zinc-300 hover:border-[#d4af37]/50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab (½)', 'Min'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[82px] rounded-xl bg-zinc-950/30" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const iso = `${calMonth}-${String(day).padStart(2, '0')}`;
              const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
              const dayLeaves = leaves.filter(
                (l) => (l.status === 'approved' || l.status === 'pending') && l.startDate <= iso && l.endDate >= iso
              );
              const isToday = iso === todayIso;
              return (
                <div
                  key={iso}
                  className={`min-h-[82px] rounded-xl border p-2 text-left ${
                    isToday
                      ? 'border-[#d4af37]/60 bg-[#d4af37]/10'
                      : dow === 0
                        ? 'border-zinc-900 bg-zinc-950/30 opacity-60'
                        : 'border-zinc-800/80 bg-zinc-950/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className={isToday ? 'text-[#f5d77f]' : dow === 0 ? 'text-red-400/70' : 'text-zinc-300'}>{day}</span>
                    {dow === 6 && <span className="text-[9px] text-zinc-600">½</span>}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayLeaves.slice(0, 3).map((l) => (
                      <div
                        key={l.id}
                        title={`${l.employeeName} — ${LEAVE_TYPE_META[l.leaveType]?.label} (${l.status})`}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          l.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-amber-500/20 text-amber-200'
                        }`}
                      >
                        {l.employeeName}
                      </div>
                    ))}
                    {dayLeaves.length > 3 && (
                      <div className="text-[9px] text-zinc-500">+{dayLeaves.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Quotas & WFH (BOD only) */}
      {tab === 'quotas' && isBod && (
        <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] uppercase text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-bold">Karyawan</th>
                <th className="px-4 py-3 font-bold">Cuti Tahunan (BOD ACC)</th>
                <th className="px-4 py-3 font-bold text-right">Kuota</th>
                <th className="px-4 py-3 font-bold text-right">Terpakai</th>
                <th className="px-4 py-3 font-bold text-right">Sisa</th>
                <th className="px-4 py-3 font-bold">Jadwal WFH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {staffQuotas.map((s) => (
                <tr key={s.userId} className="hover:bg-[#d4af37]/[0.03]">
                  <td className="px-4 py-3">
                    <div className="font-bold text-zinc-100">{s.name}</div>
                    {s.department && <div className="text-[11px] text-zinc-500">{s.department}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {s.cutiEligible ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        BOD ACC ✓ {s.cutiApprovedBy ? `(${s.cutiApprovedBy})` : ''}
                      </span>
                    ) : (
                      <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 text-[10px] text-zinc-500">
                        Belum ACC
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">{s.cutiEligible ? s.annualQuota : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-400">{s.usedDays}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">{s.cutiEligible ? s.remainingDays : '-'}</td>
                  <td className="px-4 py-3">
                    {s.wfhApproved ? (
                      <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                        WFH: {s.wfhDays.length > 0 ? s.wfhDays.map(wfhShort).join(', ') : 'Set di Directory'}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">WFO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-zinc-800/80 px-4 py-3 text-xs text-zinc-500">
            Ingin mengubah BOD ACC Cuti Tahunan atau hari WFH? Atur langsung di{' '}
            <Link href="/hrd/employees" className="font-bold text-[#f5d77f] underline">Employee Directory</Link>.
          </div>
        </div>
      )}

      {showModal && <RequestLeaveModal myQuota={myQuota} onClose={() => setShowModal(false)} />}
    </div>
  );
}
