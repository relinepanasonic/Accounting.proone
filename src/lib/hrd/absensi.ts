import type { EmployeeProfileData, WeekdayKey } from '@/lib/hrd/types';

export type WorkMode = 'wfo' | 'wfh' | 'client_visit';

export const WORK_MODE_META: Record<WorkMode, { label: string; short: string; tone: string }> = {
  wfo: { label: 'Work From Office (WFO)', short: 'WFO', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  wfh: { label: 'Work From Home (WFH)', short: 'WFH', tone: 'border-purple-500/40 bg-purple-500/10 text-purple-300' },
  client_visit: { label: 'Client Visit / Dinas Luar', short: 'Visit', tone: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
};

/** Returns current YYYY-MM-DD in Asia/Jakarta (WIB). */
export function jakartaDateIso(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/** Returns current HH:mm in Asia/Jakarta (WIB). */
export function jakartaTimeHM(date = new Date()): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Returns current day-of-week (0=Sun..6=Sat) in Asia/Jakarta. */
export function jakartaDayOfWeek(date = new Date()): number {
  const iso = jakartaDateIso(date);
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function weekdayKeyFromDow(dow: number): WeekdayKey | null {
  const map: Record<number, WeekdayKey> = {
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };
  return map[dow] || null;
}

export function isTodayWfhAllowed(profile: EmployeeProfileData, date = new Date()): boolean {
  if (!profile.wfhApproved) return false;
  const key = weekdayKeyFromDow(jakartaDayOfWeek(date));
  if (!key) return false;
  return profile.wfhDays.includes(key);
}

/** Parses "HH:mm" into minutes since midnight. */
export function hmToMinutes(hm: string): number {
  const [h, m] = (hm || '09:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Returns the employee's expected shift start/end for a given date (handling Saturday half-day). */
export function getShiftForDate(profile: EmployeeProfileData, date = new Date()): {
  start: string;
  end: string;
  isSaturdayHalfDay: boolean;
  isSunday: boolean;
} {
  const dow = jakartaDayOfWeek(date);
  if (dow === 0) {
    return { start: profile.workStartTime || '09:00', end: profile.workEndTime || '18:00', isSaturdayHalfDay: false, isSunday: true };
  }
  if (dow === 6 && profile.satHalfDay) {
    return {
      start: profile.satWorkStart || '09:00',
      end: profile.satWorkEnd || '14:00',
      isSaturdayHalfDay: true,
      isSunday: false,
    };
  }
  return {
    start: profile.workStartTime || '09:00',
    end: profile.workEndTime || '18:00',
    isSaturdayHalfDay: false,
    isSunday: false,
  };
}

/** Calculates late minutes on check-in (with optional grace period, default 5 min). */
export function calcLateMinutes(checkInDate: Date, shiftStartHM: string, graceMinutes = 5): number {
  const actual = hmToMinutes(jakartaTimeHM(checkInDate));
  const expected = hmToMinutes(shiftStartHM);
  const diff = actual - expected;
  return diff > graceMinutes ? diff : 0;
}

/** Calculates early-out, overtime, and total worked minutes on check-out. */
export function calcCheckOutMetrics(checkInIso: string | null, checkOutDate: Date, shiftEndHM: string): {
  earlyOutMinutes: number;
  overtimeMinutes: number;
  workMinutes: number;
} {
  const actualOut = hmToMinutes(jakartaTimeHM(checkOutDate));
  const expectedOut = hmToMinutes(shiftEndHM);
  const earlyOutMinutes = actualOut < expectedOut ? expectedOut - actualOut : 0;
  const overtimeMinutes = actualOut > expectedOut + 15 ? actualOut - expectedOut : 0;
  const workMinutes = checkInIso
    ? Math.max(0, Math.round((checkOutDate.getTime() - new Date(checkInIso).getTime()) / 60000))
    : 0;
  return { earlyOutMinutes, overtimeMinutes, workMinutes };
}

/** Haversine distance in meters between two GPS coordinates. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDurationMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return rem === 0 ? `${h}j` : `${h}j ${rem}m`;
}
