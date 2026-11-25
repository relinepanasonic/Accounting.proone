'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Plus,
  Send,
  Wallet,
  X,
} from 'lucide-react';
import {
  cancelKasbonRequest,
  markKasbonDisbursed,
  recordKasbonPayment,
  reviewKasbonRequest,
  submitKasbonRequest,
} from '@/app/actions/hrd';
import { formatRp, KASBON_STATUS_META, type KasbonStatus } from '@/lib/hrd/types';

export interface KasbonPaymentRow {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'payroll_deduction' | 'manual_transfer';
  payrollMonth: string;
  notes: string;
  recordedByName: string;
}

export interface KasbonRow {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  bankInfo: string;
  kasbonLimit: number;
  amount: number;
  reason: string;
  installmentMonths: number;
  monthlyInstallment: number;
  paidAmount: number;
  remainingAmount: number;
  paidInstallments: number;
  startDeductionMonth: string;
  status: KasbonStatus;
  reviewedByName: string;
  reviewNote: string;
  disbursedAt: string | null;
  disbursedByName: string;
  createdAt: string;
  payments: KasbonPaymentRow[];
}

const inputCls =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none [color-scheme:dark]';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-400';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });

function RequestKasbonModal({
  myKasbonLimit,
  myActiveOutstanding,
  onClose,
}: {
  myKasbonLimit: number;
  myActiveOutstanding: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const defaultMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7);
  const [amount, setAmount] = useState<string>('500000');
  const [installments, setInstallments] = useState<number>(1);
  const [startMonth, setStartMonth] = useState(defaultMonth);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const numAmount = Math.max(0, Number(amount || 0));
  const monthly = installments > 0 ? Math.ceil(numAmount / installments) : numAmount;
  const overLimit = myKasbonLimit > 0 && numAmount + myActiveOutstanding > myKasbonLimit;

  const handleSubmit = () => {
    setError('');
    start(async () => {
      const res = await submitKasbonRequest({
        amount: numAmount,
        installmentMonths: installments,
        startDeductionMonth: startMonth,
        reason,
      });
      if (!res.success) {
        setError(res.error || 'Could not submit Kasbon request.');
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => !pending && onClose()}>
      <div
        className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-extrabold text-white">Ajukan Kasbon</h3>
            <p className="text-xs text-zinc-500">Pengajuan akan diteruskan ke BOD / Accounting untuk ACC.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className={labelCls}>
            Jumlah Kasbon (Rp) *
            <input
              type="number"
              min={50000}
              step={50000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} mt-1 font-mono text-base font-bold`}
            />
          </label>

          {myKasbonLimit > 0 && (
            <div className={`rounded-xl border px-3 py-2 text-[11px] ${overLimit ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400'}`}>
              Limit Kasbon Anda: <b className="text-zinc-200">{formatRp(myKasbonLimit)}</b>
              {myActiveOutstanding > 0 && ` · Sisa aktif: ${formatRp(myActiveOutstanding)}`}
              {overLimit && ' — Melebihi limit (tetap bisa diajukan, butuh pertimbangan khusus BOD).'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Tenor Cicilan
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className={`${inputCls} mt-1`}
              >
                {[1, 2, 3, 4, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m === 1 ? '1x (Potong sekaligus)' : `${m}x Cicilan (${m} bulan)`}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Mulai Potong Bulan
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/5 px-4 py-2.5 text-xs">
            <span className="text-zinc-300">Estimasi Potongan / Bulan</span>
            <span className="font-mono text-base font-extrabold text-[#f5d77f]">{formatRp(monthly)}</span>
          </div>

          <label className={labelCls}>
            Keperluan / Alasan *
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan keperluan kasbon..."
              className={`${inputCls} mt-1 normal-case`}
            />
          </label>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" disabled={pending} onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">
            Batal
          </button>
          <button
            type="button"
            disabled={pending || numAmount <= 0 || reason.trim().length < 3}
            onClick={handleSubmit}
            className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40"
          >
            {pending ? 'Mengirim...' : 'Ajukan Kasbon'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({
  kasbon,
  onClose,
}: {
  kasbon: KasbonRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const defaultMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7);
  const suggested = Math.min(kasbon.remainingAmount, kasbon.monthlyInstallment);
  const [amount, setAmount] = useState(String(suggested));
  const [method, setMethod] = useState<'payroll_deduction' | 'manual_transfer'>('payroll_deduction');
  const [payrollMonth, setPayrollMonth] = useState(defaultMonth);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const handleSave = () => {
    setError('');
    start(async () => {
      const res = await recordKasbonPayment({
        kasbonId: kasbon.id,
        amount: Number(amount || 0),
        paymentMethod: method,
        payrollMonth,
        notes,
      });
      if (!res.success) {
        setError(res.error || 'Could not record payment.');
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => !pending && onClose()}>
      <div
        className="w-full max-w-md space-y-4 rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-extrabold text-white">Catat Pembayaran Cicilan</h3>
            <p className="text-xs text-zinc-400">
              {kasbon.employeeName} · Sisa: <b className="text-[#f5d77f]">{formatRp(kasbon.remainingAmount)}</b>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className={labelCls}>
            Jumlah Dibayar (Rp)
            <input
              type="number"
              min={1}
              max={kasbon.remainingAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} mt-1 font-mono font-bold`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Metode
              <select value={method} onChange={(e) => setMethod(e.target.value as any)} className={`${inputCls} mt-1`}>
                <option value="payroll_deduction">Potong Gaji (Payroll)</option>
                <option value="manual_transfer">Transfer Manual</option>
              </select>
            </label>
            <label className={labelCls}>
              Bulan Payroll
              <input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} className={`${inputCls} mt-1`} />
            </label>
          </div>
          <label className={labelCls}>
            Catatan (opsional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cicilan ke-1, pelunasan, dll." className={`${inputCls} mt-1 normal-case`} />
          </label>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" disabled={pending} onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">
            Batal
          </button>
          <button
            type="button"
            disabled={pending || Number(amount || 0) <= 0}
            onClick={handleSave}
            className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40"
          >
            {pending ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KasbonBoard({
  kasbons,
  currentUserId,
  myKasbonLimit,
  myBaseSalary,
  isBod,
  migrationRequired,
}: {
  kasbons: KasbonRow[];
  currentUserId: string;
  myKasbonLimit: number;
  myBaseSalary: number;
  isBod: boolean;
  migrationRequired: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'paid_off' | 'mine'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [payingKasbon, setPayingKasbon] = useState<KasbonRow | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const visible = useMemo(() => (isBod ? kasbons : kasbons.filter((k) => k.userId === currentUserId)), [kasbons, isBod, currentUserId]);

  const filtered = useMemo(() => {
    return visible.filter((k) => {
      if (filter === 'pending') return k.status === 'pending';
      if (filter === 'active') return k.status === 'approved' || k.status === 'disbursed' || k.status === 'paying';
      if (filter === 'paid_off') return k.status === 'paid_off';
      if (filter === 'mine') return k.userId === currentUserId;
      return true;
    });
  }, [visible, filter, currentUserId]);

  const activeRows = visible.filter((k) => k.status === 'disbursed' || k.status === 'paying');
  const totalOutstanding = activeRows.reduce((s, k) => s + k.remainingAmount, 0);
  const monthlyDue = activeRows.reduce((s, k) => s + Math.min(k.remainingAmount, k.monthlyInstallment), 0);
  const pendingRows = visible.filter((k) => k.status === 'pending');
  const pendingAmount = pendingRows.reduce((s, k) => s + k.amount, 0);
  const myActiveOutstanding = kasbons
    .filter((k) => k.userId === currentUserId && (k.status === 'approved' || k.status === 'disbursed' || k.status === 'paying'))
    .reduce((s, k) => s + k.remainingAmount, 0);

  const handleReview = (id: string, decision: 'approved' | 'rejected') => {
    const note = decision === 'rejected' ? window.prompt('Alasan penolakan (opsional):') || '' : '';
    setError('');
    start(async () => {
      const res = await reviewKasbonRequest(id, decision, note);
      if (!res.success) setError(res.error || 'Failed.');
      else router.refresh();
    });
  };

  const handleDisburse = (k: KasbonRow) => {
    if (!window.confirm(`Tandai Kasbon ${k.employeeName} (${formatRp(k.amount)}) sudah ditransfer / cair?`)) return;
    setError('');
    start(async () => {
      const res = await markKasbonDisbursed(k.id);
      if (!res.success) setError(res.error || 'Failed.');
      else router.refresh();
    });
  };

  const handleCancel = (id: string) => {
    if (!window.confirm('Batalkan pengajuan kasbon ini?')) return;
    setError('');
    start(async () => {
      const res = await cancelKasbonRequest(id);
      if (!res.success) setError(res.error || 'Failed.');
      else router.refresh();
    });
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>{isBod ? 'Total Sisa Kasbon Tim' : 'Sisa Kasbon Saya'}</span>
            <Banknote className="h-4 w-4 text-[#f5d77f]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#f5d77f]">{formatRp(totalOutstanding)}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{activeRows.length} kasbon aktif berjalan</div>
        </div>

        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>Potongan Payroll / Bulan</span>
            <CreditCard className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-sky-300">{formatRp(monthlyDue)}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Total cicilan jatuh tempo bulan ini</div>
        </div>

        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>Menunggu ACC BOD</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className={`mt-2 font-mono text-2xl font-extrabold ${pendingRows.length > 0 ? 'text-amber-300' : 'text-zinc-100'}`}>
            {pendingRows.length} <span className="text-xs font-normal text-zinc-500">({formatRp(pendingAmount)})</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">Pengajuan pending</div>
        </div>

        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <span>Limit Kasbon Saya</span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-emerald-300">
            {myKasbonLimit > 0 ? formatRp(myKasbonLimit) : 'Sesuai ACC BOD'}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {myBaseSalary > 0 ? `Gaji pokok tercatat: ${formatRp(myBaseSalary)}` : 'Atur limit di Employee Directory'}
          </div>
        </div>
      </div>

      {/* Filters + Request CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'Semua'],
              ['pending', 'Pending BOD'],
              ['active', 'Aktif / Cicilan'],
              ['paid_off', 'Lunas'],
              ...(isBod ? [['mine', 'Kasbon Saya']] : []),
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k as any)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                filter === k
                  ? 'border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f5d77f]'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowRequest(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f]"
        >
          <Plus className="h-4 w-4" /> Ajukan Kasbon
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}

      {/* Kasbon Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-bold">Karyawan &amp; Rekening</th>
              <th className="px-4 py-3 font-bold text-right">Jumlah</th>
              <th className="px-4 py-3 font-bold">Cicilan &amp; Progress</th>
              <th className="px-4 py-3 font-bold">Alasan</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 text-right font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-zinc-500">
                  Belum ada data kasbon.
                </td>
              </tr>
            )}
            {filtered.map((k) => {
              const meta = KASBON_STATUS_META[k.status] || KASBON_STATUS_META.pending;
              const pct = k.amount > 0 ? Math.min(100, Math.round((k.paidAmount / k.amount) * 100)) : 0;
              const isExpanded = expandedId === k.id;
              return (
                <React.Fragment key={k.id}>
                  <tr className="align-top hover:bg-[#d4af37]/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-100">{k.employeeName}</div>
                      {k.bankInfo ? (
                        <div className="text-[11px] font-mono text-zinc-400">{k.bankInfo}</div>
                      ) : (
                        <div className="text-[10px] text-zinc-600">Rekening belum diisi di Directory</div>
                      )}
                      <div className="text-[10px] text-zinc-500">{fmtDate(k.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-mono font-extrabold text-zinc-100">{formatRp(k.amount)}</div>
                      {k.kasbonLimit > 0 && k.amount > k.kasbonLimit && (
                        <div className="text-[10px] text-amber-400">Di atas limit ({formatRp(k.kasbonLimit)})</div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="text-xs font-mono text-[#f5d77f]">
                        {formatRp(k.monthlyInstallment)} / bln × {k.installmentMonths}x
                      </div>
                      {k.startDeductionMonth && (
                        <div className="text-[10px] text-zinc-500">Mulai potong: {k.startDeductionMonth}</div>
                      )}
                      {(k.status === 'disbursed' || k.status === 'paying' || k.status === 'paid_off') && (
                        <div className="mt-1.5 space-y-1">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>Bayar: {formatRp(k.paidAmount)}</span>
                            <span className={k.remainingAmount > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                              Sisa: {formatRp(k.remainingAmount)}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="text-xs text-zinc-300">{k.reason}</div>
                      {k.reviewNote && <div className="mt-1 text-[11px] italic text-zinc-500">Note: {k.reviewNote}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${meta.tone}`}>
                        {meta.label}
                      </span>
                      {k.reviewedByName && <div className="mt-1 text-[10px] text-zinc-500">ACC: {k.reviewedByName}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        {isBod && k.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleReview(k.id, 'approved')}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                            >
                              <Check className="h-3.5 w-3.5" /> ACC
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleReview(k.id, 'rejected')}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                            >
                              <X className="h-3.5 w-3.5" /> Tolak
                            </button>
                          </>
                        )}
                        {isBod && k.status === 'approved' && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleDisburse(k)}
                            className="inline-flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-500/15 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-500/25"
                          >
                            <Send className="h-3.5 w-3.5" /> Cairkan / Transfer
                          </button>
                        )}
                        {isBod && (k.status === 'disbursed' || k.status === 'paying') && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setPayingKasbon(k)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/15 px-2.5 py-1 text-[11px] font-bold text-[#f5d77f] hover:bg-[#d4af37]/25"
                          >
                            + Bayar Cicilan
                          </button>
                        )}
                        {k.userId === currentUserId && k.status === 'pending' && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleCancel(k.id)}
                            className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-zinc-500"
                          >
                            Batal
                          </button>
                        )}
                        {k.payments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : k.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
                          >
                            Riwayat ({k.payments.length})
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && k.payments.length > 0 && (
                    <tr className="bg-zinc-950/70">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Riwayat Pembayaran Cicilan
                        </div>
                        <div className="space-y-1.5">
                          {k.payments.map((p) => (
                            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-[#0e0f14] px-3 py-2 text-xs">
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-emerald-300">{formatRp(p.amount)}</span>
                                <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                                  {p.paymentMethod === 'payroll_deduction' ? `Potong Gaji (${p.payrollMonth || '-'})` : 'Transfer Manual'}
                                </span>
                                {p.notes && <span className="text-zinc-400">{p.notes}</span>}
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {p.paymentDate} · dicatat oleh {p.recordedByName || 'Accounting'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showRequest && (
        <RequestKasbonModal
          myKasbonLimit={myKasbonLimit}
          myActiveOutstanding={myActiveOutstanding}
          onClose={() => setShowRequest(false)}
        />
      )}
      {payingKasbon && <RecordPaymentModal kasbon={payingKasbon} onClose={() => setPayingKasbon(null)} />}
    </div>
  );
}
