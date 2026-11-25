'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Printer,
  Save,
  Wallet,
  X,
} from 'lucide-react';
import { saveAllPayrollRuns, saveStaffPayrollRun, type SavePayrollRunInput } from '@/app/actions/hrd-payroll';
import { formatRp } from '@/lib/hrd/types';

export interface PayrollStaffRow {
  userId: string;
  staffId: string;
  employeeName: string;
  roleTitle: string;
  department: string;
  bankInfo: string;
  baseSalary: number;
  allowances: number;
  commissionRate: number;
  commissionBase: number;
  bonusAmount: number;
  overtimePay: number;
  kasbonDeduction: number;
  suggestedKasbon: number;
  latePenalty: number;
  unpaidLeaveDeduction: number;
  otherDeduction: number;
  attendanceDays: number;
  lateMinutes: number;
  overtimeMinutes: number;
  unpaidLeaveDays: number;
  status: 'draft' | 'approved' | 'paid';
  notes: string;
  saved: boolean;
}

function calcRow(r: PayrollStaffRow) {
  const commissionAmount = Math.round((Number(r.commissionBase || 0) * Number(r.commissionRate || 0)) / 100);
  const gross =
    Number(r.baseSalary || 0) +
    Number(r.allowances || 0) +
    commissionAmount +
    Number(r.bonusAmount || 0) +
    Number(r.overtimePay || 0);
  const deductions =
    Number(r.kasbonDeduction || 0) +
    Number(r.latePenalty || 0) +
    Number(r.unpaidLeaveDeduction || 0) +
    Number(r.otherDeduction || 0);
  const net = Math.max(0, gross - deductions);
  return { commissionAmount, gross, deductions, net };
}

const numInputCls =
  'w-28 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-right font-mono text-xs text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none';

function SlipGajiModal({
  row,
  companyName,
  payrollMonth,
  onClose,
}: {
  row: PayrollStaffRow;
  companyName: string;
  payrollMonth: string;
  onClose: () => void;
}) {
  const { commissionAmount, gross, deductions, net } = calcRow(row);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 print:static print:bg-white print:p-0" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-[#d4af37]/40 bg-[#0e0f14] p-6 shadow-2xl print:max-w-none print:border-0 print:bg-white print:text-black print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#d4af37]/20 pb-4 print:border-zinc-300">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37] print:text-zinc-600">
              SLIP GAJI KARYAWAN · {payrollMonth}
            </div>
            <h3 className="mt-1 font-serif text-xl font-extrabold text-white print:text-black">{companyName}</h3>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#d4af37] px-3 py-1.5 text-xs font-extrabold text-black hover:bg-[#f5d77f]"
            >
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs print:border-zinc-300 print:bg-zinc-50">
          <div>
            <div className="text-[10px] uppercase text-zinc-500">Nama &amp; Staff ID</div>
            <div className="mt-0.5 font-bold text-zinc-100 print:text-black">
              {row.employeeName} {row.staffId ? `(${row.staffId})` : ''}
            </div>
            <div className="text-[11px] text-zinc-400 print:text-zinc-600">
              {row.roleTitle} {row.department ? `· ${row.department}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-zinc-500">Rekening Transfer</div>
            <div className="mt-0.5 font-mono font-bold text-zinc-200 print:text-black">{row.bankInfo || '-'}</div>
            <div className="text-[11px] text-zinc-400 print:text-zinc-600">
              Hadir {row.attendanceDays}d · Telat {row.lateMinutes}m
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 text-xs print:border-zinc-300 print:bg-white">
            <div className="font-bold uppercase tracking-wider text-emerald-300 print:text-black">Penerimaan (Earnings)</div>
            <div className="flex justify-between"><span className="text-zinc-400 print:text-zinc-700">Gaji Pokok</span><span className="font-mono">{formatRp(row.baseSalary)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400 print:text-zinc-700">Tunjangan</span><span className="font-mono">{formatRp(row.allowances)}</span></div>
            <div className="flex justify-between">
              <span className="text-zinc-400 print:text-zinc-700">Komisi ({row.commissionRate}%)</span>
              <span className="font-mono">{formatRp(commissionAmount)}</span>
            </div>
            <div className="flex justify-between"><span className="text-zinc-400 print:text-zinc-700">Bonus / Lembur</span><span className="font-mono">{formatRp(row.bonusAmount + row.overtimePay)}</span></div>
            <div className="flex justify-between border-t border-zinc-800 pt-2 font-bold text-emerald-300 print:border-zinc-300 print:text-black">
              <span>Total Bruto</span><span className="font-mono">{formatRp(gross)}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4 text-xs print:border-zinc-300 print:bg-white">
            <div className="font-bold uppercase tracking-wider text-red-300 print:text-black">Potongan (Deductions)</div>
            <div className="flex justify-between"><span className="text-zinc-400 print:text-zinc-700">Bayar Kasbon</span><span className="font-mono">{formatRp(row.kasbonDeduction)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400 print:text-zinc-700">Pinalti / Telat</span><span className="font-mono">{formatRp(row.latePenalty)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400 print:text-zinc-700">Unpaid Leave / Lainnya</span><span className="font-mono">{formatRp(row.unpaidLeaveDeduction + row.otherDeduction)}</span></div>
            <div className="flex justify-between border-t border-zinc-800 pt-2 font-bold text-red-300 print:border-zinc-300 print:text-black">
              <span>Total Potongan</span><span className="font-mono">{formatRp(deductions)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-5 py-4 print:border-zinc-400 print:bg-zinc-100">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#f5d77f] print:text-zinc-700">Take Home Pay (Gaji Bersih)</div>
            <div className="text-[11px] text-zinc-400 print:text-zinc-600">Status: {row.status.toUpperCase()}</div>
          </div>
          <div className="font-mono text-2xl font-black text-[#f5d77f] print:text-black">{formatRp(net)}</div>
        </div>
      </div>
    </div>
  );
}

export function PayrollCalculator({
  initialRows,
  companyName,
  payrollMonth,
  migrationRequired,
}: {
  initialRows: PayrollStaffRow[];
  companyName: string;
  payrollMonth: string;
  migrationRequired: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PayrollStaffRow[]>(initialRows);
  const [slipRow, setSlipRow] = useState<PayrollStaffRow | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, start] = useTransition();

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const updateField = <K extends keyof PayrollStaffRow>(userId: string, key: K, value: PayrollStaffRow[K]) => {
    setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, [key]: value } : r)));
  };

  const totals = useMemo(() => {
    let gross = 0;
    let commissionAndBonus = 0;
    let deductions = 0;
    let net = 0;
    let paidCount = 0;
    for (const r of rows) {
      const c = calcRow(r);
      gross += c.gross;
      commissionAndBonus += c.commissionAmount + Number(r.bonusAmount || 0) + Number(r.overtimePay || 0);
      deductions += c.deductions;
      net += c.net;
      if (r.status === 'paid') paidCount += 1;
    }
    return { gross, commissionAndBonus, deductions, net, paidCount };
  }, [rows]);

  const toInput = (r: PayrollStaffRow, overrideStatus?: 'draft' | 'approved' | 'paid'): SavePayrollRunInput => ({
    userId: r.userId,
    payrollMonth,
    staffId: r.staffId,
    employeeName: r.employeeName,
    roleTitle: r.roleTitle,
    department: r.department,
    bankInfo: r.bankInfo,
    baseSalary: r.baseSalary,
    allowances: r.allowances,
    commissionRate: r.commissionRate,
    commissionBase: r.commissionBase,
    bonusAmount: r.bonusAmount,
    overtimePay: r.overtimePay,
    kasbonDeduction: r.kasbonDeduction,
    latePenalty: r.latePenalty,
    unpaidLeaveDeduction: r.unpaidLeaveDeduction,
    otherDeduction: r.otherDeduction,
    attendanceDays: r.attendanceDays,
    lateMinutes: r.lateMinutes,
    overtimeMinutes: r.overtimeMinutes,
    unpaidLeaveDays: r.unpaidLeaveDays,
    status: overrideStatus || r.status,
    notes: r.notes,
  });

  const handleSaveOne = (r: PayrollStaffRow, nextStatus?: 'draft' | 'approved' | 'paid') => {
    setFeedback(null);
    start(async () => {
      const res = await saveStaffPayrollRun(toInput(r, nextStatus));
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Failed to save.' });
        return;
      }
      if (nextStatus) updateField(r.userId, 'status', nextStatus);
      updateField(r.userId, 'saved', true);
      setFeedback({ type: 'ok', text: `Payroll ${r.employeeName} (${payrollMonth}) tersimpan.` });
      router.refresh();
    });
  };

  const handleSaveAll = () => {
    setFeedback(null);
    start(async () => {
      const res = await saveAllPayrollRuns(rows.map((r) => toInput(r)));
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Failed to save all.' });
        return;
      }
      setFeedback({ type: 'ok', text: `${res.savedCount} kalkulasi payroll bulan ${payrollMonth} tersimpan.` });
      router.refresh();
    });
  };

  const exportCsv = () => {
    const header = [
      'Staff ID', 'Nama', 'Role', 'Rekening', 'Gaji Pokok', 'Tunjangan', 'Komisi (%)', 'Basis Omzet', 'Komisi (Rp)',
      'Bonus/Lembur', 'Potong Kasbon', 'Pinalti/Lainnya', 'Total Bruto', 'Total Potongan', 'Take Home Pay (Net)', 'Status',
    ];
    const lines = rows.map((r) => {
      const c = calcRow(r);
      return [
        `"${r.staffId}"`,
        `"${r.employeeName.replace(/"/g, '""')}"`,
        `"${r.roleTitle}"`,
        `"${r.bankInfo.replace(/"/g, '""')}"`,
        r.baseSalary,
        r.allowances,
        r.commissionRate,
        r.commissionBase,
        c.commissionAmount,
        r.bonusAmount + r.overtimePay,
        r.kasbonDeduction,
        r.latePenalty + r.unpaidLeaveDeduction + r.otherDeduction,
        c.gross,
        c.deductions,
        c.net,
        r.status,
      ].join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${payrollMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {migrationRequired && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <b>Payroll Migration Needed:</b> Run <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px]">supabase/migrations/20261215_hrd_payroll_commission.sql</code> in Supabase SQL Editor to enable saving monthly payroll runs and Komisi (%).
          </div>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total Gaji Bruto</div>
          <div className="mt-1 font-mono text-xl font-extrabold text-zinc-100">{formatRp(totals.gross)}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">{rows.length} karyawan aktif</div>
        </div>
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Komisi &amp; Bonus</div>
          <div className="mt-1 font-mono text-xl font-extrabold text-emerald-300">{formatRp(totals.commissionAndBonus)}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">Auto-hitung dari Komisi %</div>
        </div>
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total Potongan</div>
          <div className="mt-1 font-mono text-xl font-extrabold text-red-300">{formatRp(totals.deductions)}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">Kasbon + Pinalti / Unpaid</div>
        </div>
        <div className="rounded-2xl border border-[#d4af37]/40 bg-[#d4af37]/10 p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#f5d77f]">
            <span>Total Net Payout</span>
            <Wallet className="h-4 w-4" />
          </div>
          <div className="mt-1 font-mono text-xl font-black text-[#f5d77f]">{formatRp(totals.net)}</div>
          <div className="mt-0.5 text-[11px] text-zinc-300">{totals.paidCount} / {rows.length} sudah dibayar (Paid)</div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-zinc-400">
          Gaji Pokok, Tunjangan &amp; Komisi (%) ditarik otomatis dari{' '}
          <Link href="/hrd/employees" className="font-bold text-[#f5d77f] underline">Employee Directory</Link>, potongan Kasbon dari{' '}
          <Link href="/hrd/kasbon" className="font-bold text-[#f5d77f] underline">Kasbon</Link>.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-bold text-zinc-200 hover:border-[#d4af37]/50 hover:text-[#f5d77f]"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            type="button"
            disabled={pending || rows.length === 0}
            onClick={handleSaveAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" /> {pending ? 'Menyimpan...' : 'Simpan Semua'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`rounded-xl border p-3 text-xs font-semibold ${feedback.type === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {feedback.text}
        </div>
      )}

      {/* Per-Staff Calculation Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full min-w-[1380px] text-left text-xs">
          <thead className="border-b border-[#d4af37]/15 bg-zinc-950 text-[10px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-bold">Staff ID &amp; Karyawan</th>
              <th className="px-3 py-3 font-bold text-right">Gaji Pokok</th>
              <th className="px-3 py-3 font-bold text-right">Tunjangan</th>
              <th className="px-3 py-3 font-bold text-right">Basis Omzet × Komisi %</th>
              <th className="px-3 py-3 font-bold text-right">Bonus</th>
              <th className="px-3 py-3 font-bold text-right text-red-300">Potong Kasbon</th>
              <th className="px-3 py-3 font-bold text-right text-red-300">Pinalti / Lain</th>
              <th className="px-4 py-3 font-bold text-right text-[#f5d77f]">Take Home Pay</th>
              <th className="px-3 py-3 font-bold text-center">Status</th>
              <th className="px-4 py-3 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-10 text-center text-sm text-zinc-500">
                  Belum ada staff di Employee Directory untuk perusahaan ini.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const { commissionAmount, net } = calcRow(r);
              return (
                <tr key={r.userId} className="align-top hover:bg-[#d4af37]/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.staffId && (
                        <span className="rounded border border-[#d4af37]/30 bg-[#d4af37]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#f5d77f]">
                          {r.staffId}
                        </span>
                      )}
                      <span className="font-bold text-zinc-100">{r.employeeName}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {r.roleTitle}{r.bankInfo ? ` · ${r.bankInfo}` : ''}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-mono">
                      <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">Hadir {r.attendanceDays}d</span>
                      {r.lateMinutes > 0 && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-300">Telat {r.lateMinutes}m</span>}
                      {r.unpaidLeaveDays > 0 && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">Unpaid {r.unpaidLeaveDays}d</span>}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      value={r.baseSalary}
                      onChange={(e) => updateField(r.userId, 'baseSalary', Number(e.target.value))}
                      className={numInputCls}
                    />
                  </td>

                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={r.allowances}
                      onChange={(e) => updateField(r.userId, 'allowances', Number(e.target.value))}
                      className={numInputCls}
                    />
                  </td>

                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={0}
                        step={500000}
                        value={r.commissionBase}
                        onChange={(e) => updateField(r.userId, 'commissionBase', Number(e.target.value))}
                        placeholder="Omzet"
                        className={numInputCls}
                      />
                      <span className="font-mono text-[10px] text-[#f5d77f]">×{r.commissionRate}%</span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-emerald-300">
                      = {formatRp(commissionAmount)}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={r.bonusAmount}
                      onChange={(e) => updateField(r.userId, 'bonusAmount', Number(e.target.value))}
                      className={numInputCls}
                    />
                  </td>

                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={r.kasbonDeduction}
                      onChange={(e) => updateField(r.userId, 'kasbonDeduction', Number(e.target.value))}
                      className={`${numInputCls} text-red-300`}
                    />
                    {r.suggestedKasbon > 0 && (
                      <div className="mt-1 text-[9px] text-zinc-500">Cicilan aktif: {formatRp(r.suggestedKasbon)}</div>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={25000}
                      value={r.latePenalty}
                      onChange={(e) => updateField(r.userId, 'latePenalty', Number(e.target.value))}
                      className={`${numInputCls} text-red-300`}
                    />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="font-mono text-sm font-black text-[#f5d77f]">{formatRp(net)}</div>
                    <div className="text-[9px] text-zinc-500">{r.saved ? 'Tersimpan' : 'Belum disimpan'}</div>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        r.status === 'paid'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : r.status === 'approved'
                            ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleSaveOne(r)}
                        title="Simpan draft kalkulasi"
                        className="rounded-lg border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:border-[#d4af37]/50 hover:text-[#f5d77f]"
                      >
                        Save
                      </button>
                      {r.status !== 'paid' && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleSaveOne(r, 'paid')}
                          title="Tandai sudah dibayar (Paid)"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSlipRow(r)}
                        title="Lihat & Print Slip Gaji"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-2 py-1 text-[10px] font-bold text-[#f5d77f] hover:bg-[#d4af37]/20"
                      >
                        <FileText className="h-3 w-3" /> Slip
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {slipRow && (
        <SlipGajiModal
          row={slipRow}
          companyName={companyName}
          payrollMonth={payrollMonth}
          onClose={() => setSlipRow(null)}
        />
      )}
    </div>
  );
}
