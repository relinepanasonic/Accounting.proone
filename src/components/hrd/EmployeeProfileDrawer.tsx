'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Briefcase, CalendarClock, Wallet, CheckCircle2, Home, CalendarOff, ShieldCheck } from 'lucide-react';
import { saveEmployeeProfile } from '@/app/actions/hrd';
import { WFH_DAY_OPTIONS, type EmployeeProfileData, type WeekdayKey } from '@/lib/hrd/types';

interface Props {
  person: {
    userId: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    profile: EmployeeProfileData;
  };
  canEdit: boolean;
  onClose: () => void;
}

const inputCls =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none [color-scheme:dark]';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-400';

export function EmployeeProfileDrawer({ person, canEdit, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'schedule' | 'profile' | 'compensation'>('schedule');
  const [form, setForm] = useState<EmployeeProfileData>({ ...person.profile });
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [pending, start] = useTransition();

  const set = <K extends keyof EmployeeProfileData>(key: K, value: EmployeeProfileData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedMsg('');
  };

  const toggleWfhDay = (day: WeekdayKey) => {
    if (!canEdit) return;
    setForm((prev) => ({
      ...prev,
      wfhDays: prev.wfhDays.includes(day)
        ? prev.wfhDays.filter((d) => d !== day)
        : [...prev.wfhDays, day],
    }));
    setSavedMsg('');
  };

  const handleSave = () => {
    setError('');
    setSavedMsg('');
    start(async () => {
      const res = await saveEmployeeProfile(person.userId, form);
      if (!res.success) {
        setError(res.error || 'Could not save HR profile.');
        return;
      }
      setSavedMsg('HR Profile saved.');
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs" onClick={() => !pending && onClose()}>
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-[#d4af37]/30 bg-[#0e0f14] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#d4af37]/15 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-extrabold text-white">{person.name}</h2>
              <span className="rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f5d77f]">
                {person.role}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {person.email || '-'} {person.phone ? `· ${person.phone}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800/80 bg-zinc-950/60 px-6 py-2.5">
          {[
            { key: 'schedule', label: 'Schedule, WFH & Cuti', icon: CalendarClock },
            { key: 'profile', label: 'Identity & Job', icon: Briefcase },
            { key: 'compensation', label: 'Salary, Bank & Kasbon', icon: Wallet },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as any)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                tab === key
                  ? 'border border-[#d4af37]/40 bg-[#d4af37]/15 text-[#f5d77f]'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {tab === 'schedule' && (
            <>
              {/* BOD ACC: Annual Cuti */}
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <CalendarOff className="mt-0.5 h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-zinc-100">Annual Cuti (Cuti Tahunan) — BOD ACC</div>
                      <p className="text-xs text-zinc-400">
                        Aktifkan setelah BOD (Nico / Herlan / Lucy) ACC hak cuti tahunan karyawan ini.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 shrink-0">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={form.cutiEligible}
                      onChange={(e) => set('cutiEligible', e.target.checked)}
                      className="h-4 w-4 accent-emerald-400"
                    />
                    <span className={`text-xs font-bold ${form.cutiEligible ? 'text-emerald-300' : 'text-zinc-500'}`}>
                      {form.cutiEligible ? 'BOD ACC ✓' : 'Belum ACC'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                  <label className={labelCls}>
                    Kuota Cuti Tahunan (hari/tahun)
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      disabled={!canEdit || !form.cutiEligible}
                      value={form.annualCutiQuota}
                      onChange={(e) => set('annualCutiQuota', Number(e.target.value))}
                      className={`${inputCls} mt-1 disabled:opacity-50`}
                    />
                  </label>
                  <div className="flex flex-col justify-end text-xs text-zinc-400">
                    {form.cutiEligible && form.cutiApprovedBy ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300">
                        <ShieldCheck className="h-4 w-4" /> ACC by {form.cutiApprovedBy}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-500">
                        {form.cutiEligible ? 'Will record your BOD ACC on save' : 'Karyawan belum bisa ajukan Cuti Tahunan'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* BOD ACC: WFH & WFH Days */}
              <div className="rounded-2xl border border-purple-500/25 bg-purple-500/[0.04] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Home className="mt-0.5 h-5 w-5 text-purple-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-zinc-100">Work From Home (WFH) — BOD ACC</div>
                      <p className="text-xs text-zinc-400">
                        Aktifkan jika BOD ACC karyawan ini boleh WFH, lalu pilih hari WFH-nya.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 shrink-0">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={form.wfhApproved}
                      onChange={(e) => set('wfhApproved', e.target.checked)}
                      className="h-4 w-4 accent-purple-400"
                    />
                    <span className={`text-xs font-bold ${form.wfhApproved ? 'text-purple-300' : 'text-zinc-500'}`}>
                      {form.wfhApproved ? 'WFH ACC ✓' : 'WFO Only'}
                    </span>
                  </label>
                </div>

                {form.wfhApproved && (
                  <div className="space-y-2 pt-1">
                    <div className={labelCls}>Pilih Hari WFH (Hari apa saja?)</div>
                    <div className="flex flex-wrap gap-2">
                      {WFH_DAY_OPTIONS.map((d) => {
                        const active = form.wfhDays.includes(d.key);
                        return (
                          <button
                            key={d.key}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => toggleWfhDay(d.key)}
                            className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                              active
                                ? 'border-purple-400 bg-purple-500/25 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    {form.wfhDays.length === 0 && (
                      <p className="text-[11px] text-amber-400">Pilih minimal 1 hari WFH di atas.</p>
                    )}
                    {form.wfhApprovedBy && (
                      <div className="text-[11px] text-purple-300/80">ACC by {form.wfhApprovedBy}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Work Hours & Saturday Half Day */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                <div className="text-sm font-bold text-zinc-100">Jam Kerja & Sabtu Half-Day</div>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelCls}>
                    Senin–Jumat Masuk
                    <input
                      type="time"
                      disabled={!canEdit}
                      value={form.workStartTime}
                      onChange={(e) => set('workStartTime', e.target.value)}
                      className={`${inputCls} mt-1`}
                    />
                  </label>
                  <label className={labelCls}>
                    Senin–Jumat Pulang
                    <input
                      type="time"
                      disabled={!canEdit}
                      value={form.workEndTime}
                      onChange={(e) => set('workEndTime', e.target.value)}
                      className={`${inputCls} mt-1`}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
                  <div>
                    <div className="text-xs font-bold text-zinc-200">Sabtu Half-Day</div>
                    <div className="text-[11px] text-zinc-500">Sabtu dihitung 0.5 hari kerja untuk Absensi & Cuti</div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={form.satHalfDay}
                    onChange={(e) => set('satHalfDay', e.target.checked)}
                    className="h-4 w-4 accent-[#d4af37]"
                  />
                </div>

                {form.satHalfDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelCls}>
                      Sabtu Masuk
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={form.satWorkStart}
                        onChange={(e) => set('satWorkStart', e.target.value)}
                        className={`${inputCls} mt-1`}
                      />
                    </label>
                    <label className={labelCls}>
                      Sabtu Pulang
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={form.satWorkEnd}
                        onChange={(e) => set('satWorkEnd', e.target.value)}
                        className={`${inputCls} mt-1`}
                      />
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Employee ID / NIK
                  <input
                    disabled={!canEdit}
                    value={form.employeeCode}
                    onChange={(e) => set('employeeCode', e.target.value)}
                    placeholder="e.g. EMP-001"
                    className={`${inputCls} mt-1 normal-case`}
                  />
                </label>
                <label className={labelCls}>
                  Department / Division
                  <input
                    disabled={!canEdit}
                    value={form.department}
                    onChange={(e) => set('department', e.target.value)}
                    placeholder="e.g. Optimizing, Sales, Finance"
                    className={`${inputCls} mt-1 normal-case`}
                  />
                </label>
                <label className={labelCls}>
                  Job Title
                  <input
                    disabled={!canEdit}
                    value={form.jobTitle}
                    onChange={(e) => set('jobTitle', e.target.value)}
                    placeholder="e.g. Senior Advertiser"
                    className={`${inputCls} mt-1 normal-case`}
                  />
                </label>
                <label className={labelCls}>
                  Join Date
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={form.joinDate}
                    onChange={(e) => set('joinDate', e.target.value)}
                    className={`${inputCls} mt-1`}
                  />
                </label>
                <label className={labelCls}>
                  Contract / Probation End
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={form.contractEndDate}
                    onChange={(e) => set('contractEndDate', e.target.value)}
                    className={`${inputCls} mt-1`}
                  />
                </label>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Emergency Contact</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    Contact Name
                    <input
                      disabled={!canEdit}
                      value={form.emergencyContactName}
                      onChange={(e) => set('emergencyContactName', e.target.value)}
                      placeholder="Nama keluarga / darurat"
                      className={`${inputCls} mt-1 normal-case`}
                    />
                  </label>
                  <label className={labelCls}>
                    Contact Phone
                    <input
                      disabled={!canEdit}
                      value={form.emergencyContactPhone}
                      onChange={(e) => set('emergencyContactPhone', e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className={`${inputCls} mt-1 normal-case`}
                    />
                  </label>
                </div>
              </div>

              <label className={labelCls}>
                Internal HR Notes
                <textarea
                  rows={3}
                  disabled={!canEdit}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Catatan kontrak, review kinerja, dll."
                  className={`${inputCls} mt-1 normal-case`}
                />
              </label>
            </div>
          )}

          {tab === 'compensation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className={labelCls}>
                  Gaji Pokok (Rp)
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    disabled={!canEdit}
                    value={form.baseSalary}
                    onChange={(e) => set('baseSalary', Number(e.target.value))}
                    className={`${inputCls} mt-1 font-mono`}
                  />
                </label>
                <label className={labelCls}>
                  Tunjangan Tetap (Rp)
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    disabled={!canEdit}
                    value={form.allowances}
                    onChange={(e) => set('allowances', Number(e.target.value))}
                    className={`${inputCls} mt-1 font-mono`}
                  />
                </label>
                <label className={labelCls}>
                  Max Kasbon Limit (Rp)
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    disabled={!canEdit}
                    value={form.kasbonLimit}
                    onChange={(e) => set('kasbonLimit', Number(e.target.value))}
                    placeholder="0 = no preset cap"
                    className={`${inputCls} mt-1 font-mono`}
                  />
                </label>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Bank Account (Payroll & Kasbon Transfer)</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className={labelCls}>
                    Bank Name
                    <input
                      disabled={!canEdit}
                      value={form.bankName}
                      onChange={(e) => set('bankName', e.target.value)}
                      placeholder="BCA / Mandiri"
                      className={`${inputCls} mt-1 normal-case`}
                    />
                  </label>
                  <label className={labelCls}>
                    Account Number
                    <input
                      disabled={!canEdit}
                      value={form.bankAccountNo}
                      onChange={(e) => set('bankAccountNo', e.target.value)}
                      placeholder="1234567890"
                      className={`${inputCls} mt-1 font-mono`}
                    />
                  </label>
                  <label className={labelCls}>
                    Account Holder
                    <input
                      disabled={!canEdit}
                      value={form.bankAccountName}
                      onChange={(e) => set('bankAccountName', e.target.value)}
                      placeholder="Sesuai buku tabungan"
                      className={`${inputCls} mt-1 normal-case`}
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Tax (PPh21) & BPJS</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    NPWP
                    <input
                      disabled={!canEdit}
                      value={form.npwp}
                      onChange={(e) => set('npwp', e.target.value)}
                      className={`${inputCls} mt-1 font-mono`}
                    />
                  </label>
                  <label className={labelCls}>
                    PTKP Status
                    <select
                      disabled={!canEdit}
                      value={form.ptkpStatus}
                      onChange={(e) => set('ptkpStatus', e.target.value)}
                      className={`${inputCls} mt-1`}
                    >
                      {['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelCls}>
                    BPJS Kesehatan
                    <input
                      disabled={!canEdit}
                      value={form.bpjsKesehatan}
                      onChange={(e) => set('bpjsKesehatan', e.target.value)}
                      className={`${inputCls} mt-1 font-mono`}
                    />
                  </label>
                  <label className={labelCls}>
                    BPJS Ketenagakerjaan
                    <input
                      disabled={!canEdit}
                      value={form.bpjsKetenagakerjaan}
                      onChange={(e) => set('bpjsKetenagakerjaan', e.target.value)}
                      className={`${inputCls} mt-1 font-mono`}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>
          )}
          {savedMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> {savedMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <div className="text-[11px] text-zinc-500">
            {canEdit ? 'Changes sync directly to Cuti, Kasbon, and Absensi.' : 'View only — BOD access required to edit.'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-500"
            >
              Close
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={pending}
                onClick={handleSave}
                className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40"
              >
                {pending ? 'Saving...' : 'Save HR Profile'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
