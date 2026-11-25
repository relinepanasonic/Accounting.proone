'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Home,
  MapPin,
  Navigation,
  RefreshCw,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { compressImage } from '@/lib/utils/image';
import {
  saveOfficeSettings,
  submitAbsensiCheckIn,
  submitAbsensiCheckOut,
  type OfficeSettingsData,
} from '@/app/actions/hrd-absensi';
import {
  distanceMeters,
  formatDurationMinutes,
  getShiftForDate,
  isTodayWfhAllowed,
  WORK_MODE_META,
  type WorkMode,
} from '@/lib/hrd/absensi';
import { LEAVE_TYPE_META, WFH_DAY_OPTIONS, type EmployeeProfileData, type LeaveType } from '@/lib/hrd/types';

export interface AttendanceLogRow {
  id: string;
  userId: string;
  employeeName: string;
  date: string;
  checkInTime: string | null;
  checkInPhoto: string | null;
  checkOutTime: string | null;
  checkOutPhoto: string | null;
  workMode: WorkMode;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInDistanceM: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  lateMinutes: number;
  earlyOutMinutes: number;
  overtimeMinutes: number;
  workMinutes: number;
  status: string;
  notes: string;
}

export interface ApprovedLeaveDay {
  id: string;
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
}

export interface StaffInfoRow {
  userId: string;
  name: string;
  department: string;
  profile: EmployeeProfileData;
}

const inputCls =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none [color-scheme:dark]';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-400';

const fmtTimeWib = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

const fmtDateId = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

function OfficeSettingsModal({
  initial,
  onClose,
}: {
  initial: OfficeSettingsData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<OfficeSettingsData>({ ...initial });
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const useCurrentGps = () => {
    if (!navigator.geolocation) {
      setError('Browser does not support GPS.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          officeLat: Number(pos.coords.latitude.toFixed(6)),
          officeLng: Number(pos.coords.longitude.toFixed(6)),
        }));
        setLocating(false);
      },
      (err) => {
        setError(`GPS error: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = () => {
    setError('');
    start(async () => {
      const res = await saveOfficeSettings(form);
      if (!res.success) {
        setError(res.error || 'Could not save settings.');
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
            <h3 className="font-serif text-lg font-extrabold text-white">Pengaturan Geofence Kantor</h3>
            <p className="text-xs text-zinc-500">Atur titik GPS kantor &amp; toleransi keterlambatan.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className={labelCls}>
            Nama Lokasi Kantor
            <input
              value={form.officeName}
              onChange={(e) => setForm((p) => ({ ...p, officeName: e.target.value }))}
              className={`${inputCls} mt-1 normal-case`}
            />
          </label>

          <label className={labelCls}>
            Paste Link Google Maps (opsional)
            <input
              placeholder="https://www.google.com/maps?q=-7.2388118,112.7726573"
              onChange={(e) => {
                const m = e.target.value.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
                if (m) {
                  setForm((p) => ({ ...p, officeLat: Number(m[1]), officeLng: Number(m[2]) }));
                }
              }}
              className={`${inputCls} mt-1 normal-case text-xs`}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Latitude
              <input
                type="number"
                step="0.000001"
                value={form.officeLat ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, officeLat: e.target.value ? Number(e.target.value) : null }))}
                placeholder="-6.200000"
                className={`${inputCls} mt-1 font-mono`}
              />
            </label>
            <label className={labelCls}>
              Longitude
              <input
                type="number"
                step="0.000001"
                value={form.officeLng ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, officeLng: e.target.value ? Number(e.target.value) : null }))}
                placeholder="106.816666"
                className={`${inputCls} mt-1 font-mono`}
              />
            </label>
          </div>

          <button
            type="button"
            disabled={locating}
            onClick={useCurrentGps}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-2 text-xs font-bold text-[#f5d77f] hover:bg-[#d4af37]/20"
          >
            <Navigation className="h-3.5 w-3.5" /> {locating ? 'Mengambil GPS...' : 'Ambil Lokasi Saya Sekarang sebagai Kantor'}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Radius Kantor (meter)
              <input
                type="number"
                min={20}
                max={5000}
                value={form.geofenceRadiusM}
                onChange={(e) => setForm((p) => ({ ...p, geofenceRadiusM: Number(e.target.value) }))}
                className={`${inputCls} mt-1 font-mono`}
              />
            </label>
            <label className={labelCls}>
              Toleransi Telat (menit)
              <input
                type="number"
                min={0}
                max={60}
                value={form.lateGraceMinutes}
                onChange={(e) => setForm((p) => ({ ...p, lateGraceMinutes: Number(e.target.value) }))}
                className={`${inputCls} mt-1 font-mono`}
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs">
            <span className="text-zinc-300">Wajibkan GPS aktif saat Check In</span>
            <input
              type="checkbox"
              checked={form.requireGps}
              onChange={(e) => setForm((p) => ({ ...p, requireGps: e.target.checked }))}
              className="h-4 w-4 accent-[#d4af37]"
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
            disabled={pending}
            onClick={handleSave}
            className="rounded-lg bg-[#d4af37] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#f5d77f] disabled:opacity-40"
          >
            {pending ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AbsensiBoard({
  month,
  todayWib,
  currentUserId,
  isBod,
  myProfile,
  officeSettings,
  staffList,
  logs,
  approvedLeaves,
  absensiMigrationNeeded,
}: {
  month: string;
  todayWib: string;
  currentUserId: string;
  isBod: boolean;
  myProfile: EmployeeProfileData;
  officeSettings: OfficeSettingsData;
  staffList: StaffInfoRow[];
  logs: AttendanceLogRow[];
  approvedLeaves: ApprovedLeaveDay[];
  absensiMigrationNeeded: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'my' | 'team' | 'recap'>('my');
  const [clock, setClock] = useState<string>('');
  const [todayLabel, setTodayLabel] = useState<string>('');
  const wfhAllowedToday = useMemo(() => isTodayWfhAllowed(myProfile), [myProfile]);
  const [workMode, setWorkMode] = useState<WorkMode>(wfhAllowedToday ? 'wfh' : 'wfo');
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [uiActionType, setUiActionType] = useState<'checkin' | 'checkout' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; title: string } | null>(null);
  const [showOfficeModal, setShowOfficeModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionTypeRef = useRef<'checkin' | 'checkout' | null>(null);

  // Live WIB Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setTodayLabel(
        now.toLocaleDateString('id-ID', {
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Capture GPS automatically on mount
  const fetchGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      return;
    }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('ok');
      },
      () => {
        setGpsStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    fetchGps();
  }, []);

  const currentDistanceM = useMemo(() => {
    if (!coords || officeSettings.officeLat == null || officeSettings.officeLng == null) return null;
    return distanceMeters(coords.lat, coords.lng, officeSettings.officeLat, officeSettings.officeLng);
  }, [coords, officeSettings]);

  const myShift = useMemo(() => getShiftForDate(myProfile), [myProfile]);
  const myLogs = useMemo(() => logs.filter((l) => l.userId === currentUserId), [logs, currentUserId]);
  const todayLog = useMemo(() => myLogs.find((l) => l.date === todayWib), [myLogs, todayWib]);
  const myLeaves = useMemo(() => approvedLeaves.filter((l) => l.userId === currentUserId), [approvedLeaves, currentUserId]);

  const triggerCamera = (type: 'checkin' | 'checkout') => {
    actionTypeRef.current = type;
    setUiActionType(type);
    setFeedback(null);
    fileInputRef.current?.click();
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const action = actionTypeRef.current;
    if (!e.target.files || e.target.files.length === 0 || !action) {
      actionTypeRef.current = null;
      setUiActionType(null);
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const base64 = await compressImage(e.target.files[0], 600);
      if (action === 'checkin') {
        const res = await submitAbsensiCheckIn({
          photoBase64: base64,
          workMode,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          notes: note,
        });
        if (!res.success) {
          setFeedback({ type: 'err', text: res.error || 'Gagal Check In.' });
        } else {
          setNote('');
          setFeedback({
            type: 'ok',
            text:
              res.lateMinutes && res.lateMinutes > 0
                ? `Check In berhasil (Terlambat ${res.lateMinutes} menit).`
                : 'Check In berhasil — On Time!',
          });
          router.refresh();
        }
      } else {
        const res = await submitAbsensiCheckOut({
          photoBase64: base64,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          notes: note,
        });
        if (!res.success) {
          setFeedback({ type: 'err', text: res.error || 'Gagal Check Out.' });
        } else {
          setNote('');
          setFeedback({
            type: 'ok',
            text: `Check Out berhasil! Total kerja: ${formatDurationMinutes(res.workMinutes || 0)}${
              res.overtimeMinutes ? ` · Lembur ${res.overtimeMinutes}m` : ''
            }.`,
          });
          router.refresh();
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Camera error.' });
    } finally {
      setSubmitting(false);
      actionTypeRef.current = null;
      setUiActionType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Team Monitor (Today)
  const todayTeamRows = useMemo(() => {
    return staffList.map((s) => {
      const log = logs.find((l) => l.userId === s.userId && l.date === todayWib) || null;
      const leave = approvedLeaves.find((lv) => lv.userId === s.userId && lv.startDate <= todayWib && lv.endDate >= todayWib) || null;
      const shift = getShiftForDate(s.profile);
      const wfhToday = isTodayWfhAllowed(s.profile);
      return { ...s, log, leave, shift, wfhToday };
    });
  }, [staffList, logs, approvedLeaves, todayWib]);

  const teamStatsToday = useMemo(() => {
    let hadir = 0;
    let late = 0;
    let wfh = 0;
    let cuti = 0;
    let absent = 0;
    for (const r of todayTeamRows) {
      if (r.log?.checkInTime) {
        hadir++;
        if (r.log.lateMinutes > 0) late++;
        if (r.log.workMode === 'wfh') wfh++;
      } else if (r.leave) {
        cuti++;
      } else {
        absent++;
      }
    }
    return { hadir, late, wfh, cuti, absent };
  }, [todayTeamRows]);

  // Monthly Recap per Employee
  const monthlyRecap = useMemo(() => {
    return staffList.map((s) => {
      const sLogs = logs.filter((l) => l.userId === s.userId && l.checkInTime);
      const sLeaves = approvedLeaves.filter((l) => l.userId === s.userId);
      const presentDays = sLogs.length;
      const lateLogs = sLogs.filter((l) => l.lateMinutes > 0);
      const totalLateMins = lateLogs.reduce((acc, l) => acc + l.lateMinutes, 0);
      const wfhDays = sLogs.filter((l) => l.workMode === 'wfh').length;
      const overtimeMins = sLogs.reduce((acc, l) => acc + l.overtimeMinutes, 0);
      const workMins = sLogs.reduce((acc, l) => acc + l.workMinutes, 0);
      const leaveDays = sLeaves.reduce((acc, l) => acc + l.daysCount, 0);
      return {
        ...s,
        presentDays,
        onTimeDays: presentDays - lateLogs.length,
        lateCount: lateLogs.length,
        totalLateMins,
        wfhDays,
        leaveDays,
        overtimeMins,
        workMins,
      };
    });
  }, [staffList, logs, approvedLeaves]);

  const exportRecapCsv = () => {
    const header = ['Nama', 'Department', 'Hadir', 'On Time', 'Telat (x)', 'Total Telat (menit)', 'WFH', 'Cuti/Sakit (hari)', 'Lembur (menit)', 'Total Jam Kerja'];
    const rows = monthlyRecap.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${(r.department || '').replace(/"/g, '""')}"`,
      r.presentDays,
      r.onTimeDays,
      r.lateCount,
      r.totalLateMins,
      r.wfhDays,
      r.leaveDays,
      r.overtimeMins,
      (r.workMins / 60).toFixed(1),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absensi-rekap-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {absensiMigrationNeeded && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <b>Absensi Upgrade Migration Needed:</b> Run <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px]">supabase/migrations/20261214_hrd_absensi.sql</code> in Supabase SQL Editor to enable GPS Geofence, WFO/WFH mode, Late &amp; Overtime tracking.
          </div>
        </div>
      )}

      {/* Top Controls: Tabs + Month Picker + Office Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${tab === 'my' ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#f5d77f]' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Absensi Saya
          </button>
          {isBod && (
            <>
              <button
                type="button"
                onClick={() => setTab('team')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${tab === 'team' ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#f5d77f]' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Users className="h-3.5 w-3.5" /> Monitor Tim Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setTab('recap')}
                className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${tab === 'recap' ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#f5d77f]' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Rekap Bulanan
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => router.push(`/hrd/absensi?month=${e.target.value}`)}
            className="rounded-lg border border-[#d4af37]/30 bg-[#0e0f14] px-3 py-1.5 text-sm text-zinc-100 focus:border-[#d4af37] focus:outline-none [color-scheme:dark]"
          />
          {isBod && (
            <button
              type="button"
              onClick={() => setShowOfficeModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 hover:border-[#d4af37]/50 hover:text-[#f5d77f]"
            >
              <Settings className="h-3.5 w-3.5" /> Geofence Kantor
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: MY ATTENDANCE */}
      {tab === 'my' && (
        <div className="space-y-6">
          {/* Live WIB Clock & Shift Banner */}
          <div className="rounded-2xl border border-[#d4af37]/25 bg-gradient-to-br from-[#0e0f14] via-[#12131b] to-[#0e0f14] p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#d4af37]">
                  <Clock className="h-4 w-4" /> Waktu Indonesia Barat (WIB)
                </div>
                <div className="mt-1 font-mono text-4xl font-black tracking-tight text-white">
                  {clock || '--:--:--'}
                </div>
                <div className="mt-1 text-xs text-zinc-400">{todayLabel}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2 text-xs">
                  <div className="text-[10px] font-bold uppercase text-zinc-500">
                    {myShift.isSaturdayHalfDay ? 'Shift Sabtu (Half-Day)' : myShift.isSunday ? 'Hari Minggu' : 'Shift Kerja'}
                  </div>
                  <div className="mt-0.5 font-mono font-bold text-zinc-100">
                    {myShift.isSunday ? 'Libur' : `${myShift.start} – ${myShift.end}`}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2 text-xs">
                  <div className="text-[10px] font-bold uppercase text-zinc-500">Status WFH Hari Ini</div>
                  <div className={`mt-0.5 font-bold ${wfhAllowedToday ? 'text-purple-300' : 'text-zinc-300'}`}>
                    {wfhAllowedToday
                      ? 'WFH Diizinkan (BOD ACC)'
                      : myProfile.wfhApproved && myProfile.wfhDays.length > 0
                        ? `WFO (WFH: ${myProfile.wfhDays.map((d) => WFH_DAY_OPTIONS.find((x) => x.key === d)?.short || d).join(', ')})`
                        : 'WFO'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchGps}
                  className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2 text-left text-xs hover:border-[#d4af37]/40"
                >
                  <MapPin className={`h-4 w-4 ${gpsStatus === 'ok' ? 'text-emerald-400' : gpsStatus === 'error' ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <div>
                    <div className="text-[10px] font-bold uppercase text-zinc-500">Lokasi GPS</div>
                    <div className="font-mono text-[11px] text-zinc-200">
                      {gpsStatus === 'loading'
                        ? 'Mencari GPS...'
                        : gpsStatus === 'ok' && coords
                          ? currentDistanceM != null
                            ? `${currentDistanceM}m dari ${officeSettings.officeName}${currentDistanceM <= officeSettings.geofenceRadiusM ? ' ✓' : ' (Luar radius)'}`
                            : `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                          : 'GPS tidak aktif (klik refresh)'}
                    </div>
                  </div>
                  <RefreshCw className="h-3 w-3 text-zinc-500" />
                </button>
              </div>
            </div>

            {/* Work Mode Picker & Note (before check-in) */}
            {!todayLog?.checkInTime && (
              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-800/80 pt-5 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className={`${labelCls} mb-1.5`}>Mode Kerja Hari Ini</div>
                  <div className="flex flex-wrap gap-2">
                    {(['wfo', 'wfh', 'client_visit'] as WorkMode[]).map((m) => {
                      const locked = m === 'wfh' && !wfhAllowedToday && !isBod;
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={locked}
                          onClick={() => setWorkMode(m)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                            workMode === m
                              ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f5d77f]'
                              : locked
                                ? 'cursor-not-allowed border-zinc-900 bg-zinc-950/40 text-zinc-600'
                                : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          {m === 'wfo' ? <Building2 className="h-3.5 w-3.5" /> : m === 'wfh' ? <Home className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                          {WORK_MODE_META[m].short}
                          {locked && <span className="text-[10px] text-zinc-600">(Bukan hari WFH)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className={labelCls}>
                  Catatan (opsional)
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={workMode === 'client_visit' ? 'Nama klien / lokasi...' : 'Catatan singkat...'}
                    className={`${inputCls} mt-1 normal-case`}
                  />
                </label>
              </div>
            )}

            {/* Hidden camera input */}
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              ref={fileInputRef}
              onChange={handleCameraCapture}
            />

            {/* Check In / Check Out Buttons */}
            <div className="mt-5 flex flex-col gap-4 md:flex-row">
              <button
                type="button"
                onClick={() => triggerCamera('checkin')}
                disabled={submitting || !!todayLog?.checkInTime}
                className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-500/35 bg-emerald-500/5 p-7 text-emerald-400 transition-all hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {todayLog?.checkInTime ? <CheckCircle2 className="mb-2 h-10 w-10" /> : <Camera className="mb-2 h-10 w-10" />}
                <span className="text-lg font-extrabold">
                  {submitting && uiActionType === 'checkin' ? 'Menyimpan...' : todayLog?.checkInTime ? 'Sudah Check In' : 'Check In (Selfie + GPS)'}
                </span>
                <span className="mt-1 font-mono text-xs opacity-80">
                  {todayLog?.checkInTime
                    ? `${fmtTimeWib(todayLog.checkInTime)} WIB · ${WORK_MODE_META[todayLog.workMode]?.short || 'WFO'}${todayLog.lateMinutes > 0 ? ` · Telat ${todayLog.lateMinutes}m` : ' · On Time'}`
                    : `Target masuk ≤ ${myShift.start} WIB`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => triggerCamera('checkout')}
                disabled={submitting || !todayLog?.checkInTime || !!todayLog?.checkOutTime}
                className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-500/35 bg-amber-500/5 p-7 text-amber-400 transition-all hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {todayLog?.checkOutTime ? <CheckCircle2 className="mb-2 h-10 w-10" /> : <Camera className="mb-2 h-10 w-10" />}
                <span className="text-lg font-extrabold">
                  {submitting && uiActionType === 'checkout' ? 'Menyimpan...' : todayLog?.checkOutTime ? 'Sudah Check Out' : 'Check Out (Selfie + GPS)'}
                </span>
                <span className="mt-1 font-mono text-xs opacity-80">
                  {todayLog?.checkOutTime
                    ? `${fmtTimeWib(todayLog.checkOutTime)} WIB · Kerja ${formatDurationMinutes(todayLog.workMinutes)}${todayLog.overtimeMinutes > 0 ? ` · Lembur ${todayLog.overtimeMinutes}m` : ''}`
                    : `Target pulang ≥ ${myShift.end} WIB`}
                </span>
              </button>
            </div>

            {feedback && (
              <div
                className={`mt-4 rounded-xl border p-3 text-xs font-semibold ${
                  feedback.type === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                }`}
              >
                {feedback.text}
              </div>
            )}
          </div>

          {/* My Monthly History */}
          <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">Riwayat Absensi Saya ({month})</div>
              {myLeaves.length > 0 && (
                <div className="text-xs text-emerald-300">
                  Cuti disetujui bulan ini: {myLeaves.reduce((s, l) => s + l.daysCount, 0)} hari
                </div>
              )}
            </div>
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-bold">Tanggal</th>
                  <th className="px-5 py-3 font-bold">Mode</th>
                  <th className="px-5 py-3 font-bold text-center">Check In</th>
                  <th className="px-5 py-3 font-bold text-center">Check Out</th>
                  <th className="px-5 py-3 font-bold">Status &amp; Durasi</th>
                  <th className="px-5 py-3 font-bold">Lokasi / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {myLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-sm text-zinc-500">
                      Belum ada data absensi di bulan {month}.
                    </td>
                  </tr>
                )}
                {myLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#d4af37]/[0.03]">
                    <td className="px-5 py-3 font-bold text-zinc-100">{fmtDateId(log.date)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${WORK_MODE_META[log.workMode]?.tone || WORK_MODE_META.wfo.tone}`}>
                        {WORK_MODE_META[log.workMode]?.short || 'WFO'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="font-mono font-bold text-emerald-400">{fmtTimeWib(log.checkInTime)}</div>
                      {log.checkInPhoto && (
                        <button type="button" onClick={() => setPreviewPhoto({ src: log.checkInPhoto!, title: `Check In · ${log.date}` })} className="mt-1">
                          <img src={log.checkInPhoto} alt="Check In" className="mx-auto h-9 w-9 rounded object-cover border border-emerald-500/30 hover:scale-110 transition-transform" />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="font-mono font-bold text-amber-400">{fmtTimeWib(log.checkOutTime)}</div>
                      {log.checkOutPhoto && (
                        <button type="button" onClick={() => setPreviewPhoto({ src: log.checkOutPhoto!, title: `Check Out · ${log.date}` })} className="mt-1">
                          <img src={log.checkOutPhoto} alt="Check Out" className="mx-auto h-9 w-9 rounded object-cover border border-amber-500/30 hover:scale-110 transition-transform" />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {log.lateMinutes > 0 ? (
                          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                            Telat {log.lateMinutes}m
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            On Time
                          </span>
                        )}
                        {log.overtimeMinutes > 0 && (
                          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                            Lembur +{log.overtimeMinutes}m
                          </span>
                        )}
                      </div>
                      {log.workMinutes > 0 && (
                        <div className="mt-1 text-[11px] font-mono text-zinc-400">Durasi: {formatDurationMinutes(log.workMinutes)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {log.checkInLat != null && log.checkInLng != null && (
                        <a
                          href={`https://maps.google.com/?q=${log.checkInLat},${log.checkInLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          {log.checkInDistanceM != null ? `${log.checkInDistanceM}m dari kantor` : 'Lihat Maps'}
                        </a>
                      )}
                      {log.notes && <div className="mt-0.5 text-zinc-300">{log.notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE TEAM MONITOR TODAY (BOD) */}
      {tab === 'team' && isBod && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-emerald-500/25 bg-[#0e0f14] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Hadir Hari Ini</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-300">{teamStatsToday.hadir}</div>
            </div>
            <div className="rounded-xl border border-red-500/25 bg-[#0e0f14] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Terlambat</div>
              <div className="mt-1 text-2xl font-extrabold text-red-300">{teamStatsToday.late}</div>
            </div>
            <div className="rounded-xl border border-purple-500/25 bg-[#0e0f14] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">WFH</div>
              <div className="mt-1 text-2xl font-extrabold text-purple-300">{teamStatsToday.wfh}</div>
            </div>
            <div className="rounded-xl border border-sky-500/25 bg-[#0e0f14] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cuti / Sakit</div>
              <div className="mt-1 text-2xl font-extrabold text-sky-300">{teamStatsToday.cuti}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#0e0f14] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Belum Absen</div>
              <div className="mt-1 text-2xl font-extrabold text-amber-300">{teamStatsToday.absent}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Karyawan</th>
                  <th className="px-4 py-3 font-bold">Jadwal Hari Ini</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-center">Check In</th>
                  <th className="px-4 py-3 font-bold text-center">Check Out</th>
                  <th className="px-4 py-3 font-bold">GPS &amp; Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {todayTeamRows.map((r) => (
                  <tr key={r.userId} className="hover:bg-[#d4af37]/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-100">{r.name}</div>
                      {r.department && <div className="text-[11px] text-zinc-500">{r.department}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-zinc-300">{r.shift.start}–{r.shift.end}</div>
                      {r.wfhToday && <span className="text-[10px] font-bold text-purple-300">Hari WFH ✓</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.log?.checkInTime ? (
                        <div className="flex flex-wrap gap-1">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${WORK_MODE_META[r.log.workMode]?.tone}`}>
                            {WORK_MODE_META[r.log.workMode]?.short}
                          </span>
                          {r.log.lateMinutes > 0 ? (
                            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                              Telat {r.log.lateMinutes}m
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              On Time
                            </span>
                          )}
                        </div>
                      ) : r.leave ? (
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${LEAVE_TYPE_META[r.leave.leaveType]?.tone}`}>
                          {LEAVE_TYPE_META[r.leave.leaveType]?.label}
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 text-[10px] text-zinc-500">
                          Belum Absen
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="font-mono font-bold text-emerald-400">{fmtTimeWib(r.log?.checkInTime || null)}</div>
                      {r.log?.checkInPhoto && (
                        <button type="button" onClick={() => setPreviewPhoto({ src: r.log!.checkInPhoto!, title: `${r.name} — Check In` })} className="mt-1">
                          <img src={r.log.checkInPhoto} alt={r.name} className="mx-auto h-8 w-8 rounded object-cover border border-emerald-500/30" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="font-mono font-bold text-amber-400">{fmtTimeWib(r.log?.checkOutTime || null)}</div>
                      {r.log?.checkOutPhoto && (
                        <button type="button" onClick={() => setPreviewPhoto({ src: r.log!.checkOutPhoto!, title: `${r.name} — Check Out` })} className="mt-1">
                          <img src={r.log.checkOutPhoto} alt={r.name} className="mx-auto h-8 w-8 rounded object-cover border border-amber-500/30" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {r.log?.checkInLat != null && r.log?.checkInLng != null && (
                        <a
                          href={`https://maps.google.com/?q=${r.log.checkInLat},${r.log.checkInLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          {r.log.checkInDistanceM != null ? `${r.log.checkInDistanceM}m dari kantor` : 'Buka Maps'}
                        </a>
                      )}
                      {r.log?.notes && <div className="mt-0.5 text-zinc-300">{r.log.notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MONTHLY RECAP (BOD) */}
      {tab === 'recap' && isBod && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-zinc-300">Rekap Kehadiran Bulan {month}</div>
            <button
              type="button"
              onClick={exportRecapCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-3.5 py-2 text-xs font-bold text-[#f5d77f] hover:bg-[#d4af37]/20"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-[#d4af37]/10 bg-zinc-950 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Karyawan</th>
                  <th className="px-4 py-3 font-bold text-right">Hadir</th>
                  <th className="px-4 py-3 font-bold text-right">On Time</th>
                  <th className="px-4 py-3 font-bold text-right">Terlambat</th>
                  <th className="px-4 py-3 font-bold text-right">WFH</th>
                  <th className="px-4 py-3 font-bold text-right">Cuti / Sakit</th>
                  <th className="px-4 py-3 font-bold text-right">Lembur</th>
                  <th className="px-4 py-3 font-bold text-right">Total Kerja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {monthlyRecap.map((r) => (
                  <tr key={r.userId} className="hover:bg-[#d4af37]/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-100">{r.name}</div>
                      {r.department && <div className="text-[11px] text-zinc-500">{r.department}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-zinc-100">{r.presentDays}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">{r.onTimeDays}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-300">
                      {r.lateCount > 0 ? `${r.lateCount}x (${r.totalLateMins}m)` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-purple-300">{r.wfhDays || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-sky-300">{r.leaveDays > 0 ? `${r.leaveDays}d` : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#f5d77f]">{r.overtimeMins > 0 ? formatDurationMinutes(r.overtimeMins) : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300">{r.workMins > 0 ? formatDurationMinutes(r.workMins) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selfie Lightbox */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setPreviewPhoto(null)}>
          <div className="max-w-md space-y-3 rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-xs font-bold text-zinc-200">
              <span>{previewPhoto.title}</span>
              <button type="button" onClick={() => setPreviewPhoto(null)} className="text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <img src={previewPhoto.src} alt={previewPhoto.title} className="max-h-[70vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      )}

      {showOfficeModal && <OfficeSettingsModal initial={officeSettings} onClose={() => setShowOfficeModal(false)} />}
    </div>
  );
}
