import { describe, expect, it } from 'vitest';
import { calculateWorkdays, DEFAULT_EMPLOYEE_PROFILE } from './types';
import { calcLateMinutes, distanceMeters, getShiftForDate, isTodayWfhAllowed } from './absensi';

describe('HRD core rules', () => {
  it('calculates working days skipping Sunday and counting Saturday as 0.5 when half-day is enabled', () => {
    // 2026-11-23 (Mon) to 2026-11-29 (Sun): 5 weekdays + 0.5 Saturday + 0 Sunday = 5.5
    expect(calculateWorkdays('2026-11-23', '2026-11-29', 'none', true)).toBe(5.5);
    // Same week with full-day Saturday = 6
    expect(calculateWorkdays('2026-11-23', '2026-11-29', 'none', false)).toBe(6);
    // Single Sunday = 0
    expect(calculateWorkdays('2026-11-29', '2026-11-29', 'none', true)).toBe(0);
    // Single-day half-day AM = 0.5
    expect(calculateWorkdays('2026-11-25', '2026-11-25', 'am', true)).toBe(0.5);
  });

  it('uses Saturday half-day shift hours on Saturdays', () => {
    // 2026-11-28 is Saturday
    const sat = new Date('2026-11-28T03:00:00Z'); // 10:00 WIB
    const shift = getShiftForDate(DEFAULT_EMPLOYEE_PROFILE, sat);
    expect(shift.isSaturdayHalfDay).toBe(true);
    expect(shift.start).toBe('09:00');
    expect(shift.end).toBe('14:00');
  });

  it('allows WFH only when BOD ACC is on and today matches wfhDays', () => {
    const wed = new Date('2026-11-25T03:00:00Z'); // Wednesday WIB
    expect(isTodayWfhAllowed(DEFAULT_EMPLOYEE_PROFILE, wed)).toBe(false);
    expect(isTodayWfhAllowed({ ...DEFAULT_EMPLOYEE_PROFILE, wfhApproved: true, wfhDays: ['wed', 'fri'] }, wed)).toBe(true);
    expect(isTodayWfhAllowed({ ...DEFAULT_EMPLOYEE_PROFILE, wfhApproved: true, wfhDays: ['mon', 'fri'] }, wed)).toBe(false);
  });

  it('calculates late minutes respecting grace period in WIB', () => {
    // 09:04 WIB = 02:04 UTC -> within 5m grace -> 0
    expect(calcLateMinutes(new Date('2026-11-25T02:04:00Z'), '09:00', 5)).toBe(0);
    // 09:12 WIB = 02:12 UTC -> 12m late
    expect(calcLateMinutes(new Date('2026-11-25T02:12:00Z'), '09:00', 5)).toBe(12);
  });

  it('computes Haversine geofence distance in meters', () => {
    expect(distanceMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
    // ~111m per 0.001 degree latitude
    const d = distanceMeters(-6.2, 106.8, -6.201, 106.8);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});
