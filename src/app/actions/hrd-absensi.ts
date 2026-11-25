'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isHrdBodRole, isMissingHrdTableError, mapDbProfile } from '@/lib/hrd/types';
import {
  calcCheckOutMetrics,
  calcLateMinutes,
  distanceMeters,
  getShiftForDate,
  isTodayWfhAllowed,
  jakartaDateIso,
  type WorkMode,
} from '@/lib/hrd/absensi';

export interface OfficeSettingsData {
  officeName: string;
  officeLat: number | null;
  officeLng: number | null;
  geofenceRadiusM: number;
  lateGraceMinutes: number;
  requireGps: boolean;
}

export async function saveOfficeSettings(input: OfficeSettingsData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };
    if (!isHrdBodRole(ctx.role)) {
      return { success: false, error: 'Only BOD (Founder, Superadmin, Accounting) can update office geofence settings.' };
    }

    const db = createAdminClient();
    const { error } = await db.from('hrd_office_settings').upsert(
      {
        workspace_id: ctx.activeWorkspaceId,
        office_name: input.officeName.trim() || 'Kantor Pusat',
        office_lat: input.officeLat,
        office_lng: input.officeLng,
        geofence_radius_m: Math.max(20, Math.min(5000, Math.round(Number(input.geofenceRadiusM || 150)))),
        late_grace_minutes: Math.max(0, Math.min(60, Math.round(Number(input.lateGraceMinutes ?? 5)))),
        require_gps: Boolean(input.requireGps),
        updated_by: ctx.userName || ctx.userEmail || 'BOD',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' }
    );

    if (error) {
      return {
        success: false,
        error: isMissingHrdTableError(error)
          ? 'Run supabase/migrations/20261214_hrd_absensi.sql in Supabase SQL Editor first.'
          : error.message,
      };
    }

    revalidatePath('/hrd/absensi');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save office settings.' };
  }
}

export async function submitAbsensiCheckIn(input: {
  photoBase64: string;
  workMode: WorkMode;
  lat?: number | null;
  lng?: number | null;
  notes?: string;
}): Promise<{ success: boolean; error?: string; lateMinutes?: number; distanceM?: number | null }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };

    const db = createAdminClient();
    const now = new Date();
    const todayWib = jakartaDateIso(now);

    // Load Employee Profile (HRD Brain) & Office Settings in parallel
    const [profRes, officeRes] = await Promise.all([
      db.from('employee_profiles').select('*').eq('workspace_id', ctx.activeWorkspaceId).eq('user_id', ctx.userId).maybeSingle(),
      db.from('hrd_office_settings').select('*').eq('workspace_id', ctx.activeWorkspaceId).maybeSingle(),
    ]);

    const profile = mapDbProfile(profRes.data);
    const office = officeRes.data || null;

    // Validate WFH BOD ACC if employee picks WFH
    if (input.workMode === 'wfh' && !isTodayWfhAllowed(profile, now) && !isHrdBodRole(ctx.role)) {
      return {
        success: false,
        error: 'Hari ini tidak termasuk jadwal WFH (BOD ACC) Anda di Employee Directory. Pilih WFO atau Client Visit.',
      };
    }

    if (office?.require_gps && (input.lat == null || input.lng == null)) {
      return { success: false, error: 'Lokasi GPS wajib diaktifkan untuk absen. Izinkan akses lokasi di browser Anda.' };
    }

    let distanceM: number | null = null;
    const officeLat = office?.office_lat != null ? Number(office.office_lat) : -7.2388118;
    const officeLng = office?.office_lng != null ? Number(office.office_lng) : 112.7726573;
    if (input.lat != null && input.lng != null) {
      distanceM = distanceMeters(input.lat, input.lng, officeLat, officeLng);
    }

    const shift = getShiftForDate(profile, now);
    const grace = Number(office?.late_grace_minutes ?? 5);
    const lateMinutes = shift.isSunday ? 0 : calcLateMinutes(now, shift.start, grace);
    const status = lateMinutes > 0 ? 'late' : 'on_time';

    // Try full upsert first (with upgraded columns); fallback to legacy columns if migration not yet run
    const fullPayload = {
      workspace_id: ctx.activeWorkspaceId,
      user_id: ctx.userId,
      date: todayWib,
      check_in_time: now.toISOString(),
      check_in_photo: input.photoBase64,
      work_mode: input.workMode,
      check_in_lat: input.lat ?? null,
      check_in_lng: input.lng ?? null,
      check_in_distance_m: distanceM,
      late_minutes: lateMinutes,
      status,
      notes: input.notes?.trim() || null,
    };

    const { error } = await db
      .from('sales_attendance')
      .upsert(fullPayload, { onConflict: 'workspace_id,user_id,date' });

    if (error) {
      if (/column .* does not exist/i.test(error.message)) {
        const legacy = await db.from('sales_attendance').upsert(
          {
            workspace_id: ctx.activeWorkspaceId,
            user_id: ctx.userId,
            date: todayWib,
            check_in_time: now.toISOString(),
            check_in_photo: input.photoBase64,
          },
          { onConflict: 'workspace_id,user_id,date' }
        );
        if (legacy.error) return { success: false, error: legacy.error.message };
      } else {
        return { success: false, error: error.message };
      }
    }

    revalidatePath('/hrd/absensi');
    return { success: true, lateMinutes, distanceM };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to check in.' };
  }
}

export async function submitAbsensiCheckOut(input: {
  photoBase64: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string;
}): Promise<{ success: boolean; error?: string; workMinutes?: number; overtimeMinutes?: number }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };

    const db = createAdminClient();
    const now = new Date();
    const todayWib = jakartaDateIso(now);

    const [existingRes, profRes, officeRes] = await Promise.all([
      db
        .from('sales_attendance')
        .select('id, check_in_time, notes')
        .eq('workspace_id', ctx.activeWorkspaceId)
        .eq('user_id', ctx.userId)
        .eq('date', todayWib)
        .maybeSingle(),
      db.from('employee_profiles').select('*').eq('workspace_id', ctx.activeWorkspaceId).eq('user_id', ctx.userId).maybeSingle(),
      db.from('hrd_office_settings').select('*').eq('workspace_id', ctx.activeWorkspaceId).maybeSingle(),
    ]);

    if (!existingRes.data?.check_in_time) {
      return { success: false, error: 'Anda belum Check In hari ini.' };
    }

    const profile = mapDbProfile(profRes.data);
    const office = officeRes.data || null;
    const shift = getShiftForDate(profile, now);

    let distanceM: number | null = null;
    const officeLat = office?.office_lat != null ? Number(office.office_lat) : -7.2388118;
    const officeLng = office?.office_lng != null ? Number(office.office_lng) : 112.7726573;
    if (input.lat != null && input.lng != null) {
      distanceM = distanceMeters(input.lat, input.lng, officeLat, officeLng);
    }

    const metrics = calcCheckOutMetrics(existingRes.data.check_in_time, now, shift.end);
    const mergedNotes = [existingRes.data.notes, input.notes?.trim()].filter(Boolean).join(' · ') || null;

    const { error } = await db
      .from('sales_attendance')
      .update({
        check_out_time: now.toISOString(),
        check_out_photo: input.photoBase64,
        check_out_lat: input.lat ?? null,
        check_out_lng: input.lng ?? null,
        check_out_distance_m: distanceM,
        early_out_minutes: metrics.earlyOutMinutes,
        overtime_minutes: metrics.overtimeMinutes,
        work_minutes: metrics.workMinutes,
        notes: mergedNotes,
      })
      .eq('workspace_id', ctx.activeWorkspaceId)
      .eq('user_id', ctx.userId)
      .eq('date', todayWib);

    if (error) {
      if (/column .* does not exist/i.test(error.message)) {
        const legacy = await db
          .from('sales_attendance')
          .update({
            check_out_time: now.toISOString(),
            check_out_photo: input.photoBase64,
          })
          .eq('workspace_id', ctx.activeWorkspaceId)
          .eq('user_id', ctx.userId)
          .eq('date', todayWib);
        if (legacy.error) return { success: false, error: legacy.error.message };
      } else {
        return { success: false, error: error.message };
      }
    }

    revalidatePath('/hrd/absensi');
    return { success: true, workMinutes: metrics.workMinutes, overtimeMinutes: metrics.overtimeMinutes };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to check out.' };
  }
}
