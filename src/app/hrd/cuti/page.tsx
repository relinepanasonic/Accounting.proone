import React from 'react';
import { CalendarOff, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isHrdBodRole, isMissingHrdTableError, mapDbProfile } from '@/lib/hrd/types';
import { CutiBoard, type LeaveRow, type StaffQuotaRow } from '@/components/hrd/CutiBoard';

export const dynamic = 'force-dynamic';

export default async function CutiPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.userId || !ctx.activeWorkspaceId || ctx.role === 'none' || ctx.role === 'client') {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Please sign in with a company staff account to access Cuti.</p>
      </div>
    );
  }

  const isBod = isHrdBodRole(ctx.role);
  const db = createAdminClient();
  let migrationRequired = false;

  // Load workspace members & profiles
  const { data: members } = await db
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', ctx.activeWorkspaceId);

  const memberIds = Array.from(
    new Set([ctx.userId, ...(members || []).filter((m: any) => m.role !== 'client').map((m: any) => m.user_id).filter(Boolean)])
  );

  const { data: profiles } = memberIds.length
    ? await db.from('profiles').select('id, full_name, email').in('id', memberIds)
    : { data: [] as any[] };
  const nameByUser = new Map<string, string>(
    (profiles || []).map((p: any) => [p.id, p.full_name || p.email?.split('@')[0] || 'Staff'])
  );

  // Load employee_profiles (HRD brain)
  const hrProfileByUser = new Map<string, ReturnType<typeof mapDbProfile>>();
  const hrRes = await db.from('employee_profiles').select('*').eq('workspace_id', ctx.activeWorkspaceId);
  if (hrRes.error) {
    if (isMissingHrdTableError(hrRes.error)) migrationRequired = true;
  } else {
    for (const row of hrRes.data || []) hrProfileByUser.set(row.user_id, mapDbProfile(row));
  }

  // Load leave requests
  let rawLeaves: any[] = [];
  if (!migrationRequired) {
    const lvRes = await db
      .from('hrd_leave_requests')
      .select('*')
      .eq('workspace_id', ctx.activeWorkspaceId)
      .order('created_at', { ascending: false })
      .limit(300);

    if (lvRes.error) {
      if (isMissingHrdTableError(lvRes.error)) migrationRequired = true;
    } else {
      rawLeaves = lvRes.data || [];
    }
  }

  const leaves: LeaveRow[] = rawLeaves.map((r) => ({
    id: r.id,
    userId: r.user_id,
    employeeName: nameByUser.get(r.user_id) || 'Staff',
    department: hrProfileByUser.get(r.user_id)?.department || '',
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    halfDay: r.half_day || 'none',
    daysCount: Number(r.days_count || 0),
    reason: r.reason || '',
    attachmentUrl: r.attachment_url || '',
    status: r.status,
    reviewedByName: r.reviewed_by_name || '',
    reviewedAt: r.reviewed_at || null,
    reviewNote: r.review_note || '',
    createdAt: r.created_at,
  }));

  const currentYear = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 4);

  const staffQuotas: StaffQuotaRow[] = memberIds
    .map((uid) => {
      const prof = hrProfileByUser.get(uid) || mapDbProfile(null);
      const userLeaves = leaves.filter(
        (l) => l.userId === uid && l.leaveType === 'tahunan' && l.startDate.startsWith(currentYear)
      );
      const used = userLeaves.filter((l) => l.status === 'approved').reduce((s, l) => s + l.daysCount, 0);
      const pending = userLeaves.filter((l) => l.status === 'pending').reduce((s, l) => s + l.daysCount, 0);
      return {
        userId: uid,
        name: nameByUser.get(uid) || 'Staff',
        department: prof.department,
        cutiEligible: prof.cutiEligible,
        cutiApprovedBy: prof.cutiApprovedBy,
        annualQuota: prof.annualCutiQuota,
        usedDays: used,
        pendingDays: pending,
        remainingDays: prof.cutiEligible ? Math.max(0, prof.annualCutiQuota - used) : 0,
        wfhApproved: prof.wfhApproved,
        wfhDays: prof.wfhDays,
        satHalfDay: prof.satHalfDay,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const myQuota = staffQuotas.find((s) => s.userId === ctx.userId) || {
    userId: ctx.userId,
    name: ctx.userName || 'You',
    department: '',
    cutiEligible: false,
    cutiApprovedBy: '',
    annualQuota: 12,
    usedDays: 0,
    pendingDays: 0,
    remainingDays: 0,
    wfhApproved: false,
    wfhDays: [],
    satHalfDay: true,
  };

  return (
    <div className="space-y-6 p-4 lg:p-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-[#d4af37]/10 p-3 text-[#d4af37]">
            <CalendarOff className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-extrabold text-zinc-100">Cuti &amp; Time-Off</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {ctx.activeWorkspaceName} · Leave requests, BOD approvals, team leave calendar &amp; WFH schedule.
            </p>
          </div>
        </div>
      </div>

      <CutiBoard
        leaves={leaves}
        staffQuotas={staffQuotas}
        myQuota={myQuota}
        currentUserId={ctx.userId}
        isBod={isBod}
        migrationRequired={migrationRequired}
      />
    </div>
  );
}
