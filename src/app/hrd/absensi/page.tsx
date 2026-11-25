import React from 'react';
import { CalendarCheck, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isHrdBodRole, isMissingHrdTableError, mapDbProfile } from '@/lib/hrd/types';
import { jakartaDateIso } from '@/lib/hrd/absensi';
import type { OfficeSettingsData } from '@/app/actions/hrd-absensi';
import { AbsensiBoard, type AttendanceLogRow, type ApprovedLeaveDay, type StaffInfoRow } from '@/components/hrd/AbsensiBoard';

export const dynamic = 'force-dynamic';

export default async function AbsensiPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.userId || !ctx.activeWorkspaceId || ctx.role === 'none' || ctx.role === 'client') {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Please sign in with a company staff account to access Absensi.</p>
      </div>
    );
  }

  const params = await searchParams;
  const todayWib = jakartaDateIso();
  const month = params?.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : todayWib.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

  const isBod = isHrdBodRole(ctx.role);
  const db = createAdminClient();
  let absensiMigrationNeeded = false;

  const { data: members } = await db
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', ctx.activeWorkspaceId);

  const memberIds = Array.from(
    new Set([ctx.userId, ...(members || []).filter((x: any) => x.role !== 'client').map((x: any) => x.user_id).filter(Boolean)])
  );

  const [profilesRes, hrRes, officeRes, attRes, leavesRes] = await Promise.all([
    memberIds.length ? db.from('profiles').select('id, full_name, email').in('id', memberIds) : Promise.resolve({ data: [] as any[] }),
    db.from('employee_profiles').select('*').eq('workspace_id', ctx.activeWorkspaceId),
    db.from('hrd_office_settings').select('*').eq('workspace_id', ctx.activeWorkspaceId).maybeSingle(),
    db
      .from('sales_attendance')
      .select('*')
      .eq('workspace_id', ctx.activeWorkspaceId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false }),
    db
      .from('hrd_leave_requests')
      .select('id, user_id, leave_type, start_date, end_date, days_count')
      .eq('workspace_id', ctx.activeWorkspaceId)
      .eq('status', 'approved')
      .lte('start_date', monthEnd)
      .gte('end_date', monthStart),
  ]);

  if (officeRes.error && isMissingHrdTableError(officeRes.error)) {
    absensiMigrationNeeded = true;
  }

  const nameByUser = new Map<string, string>(
    (profilesRes.data || []).map((p: any) => [p.id, p.full_name || p.email?.split('@')[0] || 'Staff'])
  );
  const hrByUser = new Map<string, ReturnType<typeof mapDbProfile>>();
  for (const row of hrRes.data || []) hrByUser.set(row.user_id, mapDbProfile(row));

  const staffList: StaffInfoRow[] = memberIds
    .map((uid) => {
      const prof = hrByUser.get(uid) || mapDbProfile(null);
      return {
        userId: uid,
        name: nameByUser.get(uid) || 'Staff',
        department: prof.department,
        profile: prof,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const myProfile = hrByUser.get(ctx.userId) || mapDbProfile(null);

  const officeSettings: OfficeSettingsData = {
    officeName: officeRes.data?.office_name || 'Kantor Pusat',
    officeLat: officeRes.data?.office_lat ?? null,
    officeLng: officeRes.data?.office_lng ?? null,
    geofenceRadiusM: Number(officeRes.data?.geofence_radius_m ?? 150),
    lateGraceMinutes: Number(officeRes.data?.late_grace_minutes ?? 5),
    requireGps: Boolean(officeRes.data?.require_gps),
  };

  const logs: AttendanceLogRow[] = (attRes.data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    employeeName: nameByUser.get(r.user_id) || 'Staff',
    date: r.date,
    checkInTime: r.check_in_time || null,
    checkInPhoto: r.check_in_photo || null,
    checkOutTime: r.check_out_time || null,
    checkOutPhoto: r.check_out_photo || null,
    workMode: (r.work_mode || 'wfo') as 'wfo' | 'wfh' | 'client_visit',
    checkInLat: r.check_in_lat ?? null,
    checkInLng: r.check_in_lng ?? null,
    checkInDistanceM: r.check_in_distance_m ?? null,
    checkOutLat: r.check_out_lat ?? null,
    checkOutLng: r.check_out_lng ?? null,
    lateMinutes: Number(r.late_minutes || 0),
    earlyOutMinutes: Number(r.early_out_minutes || 0),
    overtimeMinutes: Number(r.overtime_minutes || 0),
    workMinutes: Number(r.work_minutes || 0),
    status: r.status || 'on_time',
    notes: r.notes || '',
  }));

  const approvedLeaves: ApprovedLeaveDay[] = (leavesRes.data || []).map((l: any) => ({
    id: l.id,
    userId: l.user_id,
    leaveType: l.leave_type,
    startDate: l.start_date,
    endDate: l.end_date,
    daysCount: Number(l.days_count || 0),
  }));

  return (
    <div className="space-y-6 p-4 lg:p-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-[#d4af37]/10 p-3 text-[#d4af37]">
          <CalendarCheck className="h-7 w-7" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-zinc-100">Absensi</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {ctx.activeWorkspaceName} · Live WIB attendance, selfie + GPS geofence, WFO/WFH schedule &amp; team monitor.
          </p>
        </div>
      </div>

      <AbsensiBoard
        month={month}
        todayWib={todayWib}
        currentUserId={ctx.userId}
        isBod={isBod}
        myProfile={myProfile}
        officeSettings={officeSettings}
        staffList={staffList}
        logs={logs}
        approvedLeaves={approvedLeaves}
        absensiMigrationNeeded={absensiMigrationNeeded}
      />
    </div>
  );
}
