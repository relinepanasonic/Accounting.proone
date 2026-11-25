'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import {
  calculateWorkdays,
  isHrdBodRole,
  isMissingHrdTableError,
  type EmployeeProfileData,
  type HalfDayOption,
  type LeaveType,
} from '@/lib/hrd/types';

function migrationErr() {
  return 'HRD tables are not set up yet. Run supabase/migrations/20261213_hrd_core.sql in Supabase SQL Editor first.';
}

// ============================================================================
// 1. EMPLOYEE DIRECTORY ("THE BRAIN")
// ============================================================================

export async function saveEmployeeProfile(
  targetUserId: string,
  profile: EmployeeProfileData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };
    if (!isHrdBodRole(ctx.role)) {
      return { success: false, error: 'Only BOD (Founder, Superadmin, Accounting) can edit employee HR profiles.' };
    }

    const db = createAdminClient();
    const approverName = ctx.userName || ctx.userEmail || 'BOD';

    // Read existing to preserve approver timestamps if unchanged
    const { data: existing, error: fetchErr } = await db
      .from('employee_profiles')
      .select('wfh_approved, wfh_approved_by, wfh_approved_at, cuti_eligible, cuti_approved_by, cuti_approved_at')
      .eq('workspace_id', ctx.activeWorkspaceId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (fetchErr && isMissingHrdTableError(fetchErr)) {
      return { success: false, error: migrationErr() };
    }

    const nowIso = new Date().toISOString();
    const wfhApprovedBy = profile.wfhApproved
      ? existing?.wfh_approved
        ? existing.wfh_approved_by || approverName
        : approverName
      : null;
    const wfhApprovedAt = profile.wfhApproved
      ? existing?.wfh_approved
        ? existing.wfh_approved_at || nowIso
        : nowIso
      : null;

    const cutiApprovedBy = profile.cutiEligible
      ? existing?.cuti_eligible
        ? existing.cuti_approved_by || approverName
        : approverName
      : null;
    const cutiApprovedAt = profile.cutiEligible
      ? existing?.cuti_eligible
        ? existing.cuti_approved_at || nowIso
        : nowIso
      : null;

    const payload = {
      workspace_id: ctx.activeWorkspaceId,
      user_id: targetUserId,
      employee_code: profile.employeeCode.trim() || null,
      job_title: profile.jobTitle.trim() || null,
      department: profile.department.trim() || null,
      join_date: profile.joinDate || null,
      contract_end_date: profile.contractEndDate || null,
      emergency_contact_name: profile.emergencyContactName.trim() || null,
      emergency_contact_phone: profile.emergencyContactPhone.trim() || null,
      work_start_time: profile.workStartTime || '09:00',
      work_end_time: profile.workEndTime || '18:00',
      sat_half_day: Boolean(profile.satHalfDay),
      sat_work_start: profile.satWorkStart || '09:00',
      sat_work_end: profile.satWorkEnd || '14:00',
      wfh_approved: Boolean(profile.wfhApproved),
      wfh_days: profile.wfhApproved ? profile.wfhDays : [],
      wfh_approved_by: wfhApprovedBy,
      wfh_approved_at: wfhApprovedAt,
      cuti_eligible: Boolean(profile.cutiEligible),
      annual_cuti_quota: Math.max(0, Number(profile.annualCutiQuota || 0)),
      cuti_approved_by: cutiApprovedBy,
      cuti_approved_at: cutiApprovedAt,
      base_salary: Math.max(0, Number(profile.baseSalary || 0)),
      allowances: Math.max(0, Number(profile.allowances || 0)),
      bank_name: profile.bankName.trim() || null,
      bank_account_no: profile.bankAccountNo.trim() || null,
      bank_account_name: profile.bankAccountName.trim() || null,
      npwp: profile.npwp.trim() || null,
      ptkp_status: profile.ptkpStatus.trim() || 'TK/0',
      bpjs_kesehatan: profile.bpjsKesehatan.trim() || null,
      bpjs_ketenagakerjaan: profile.bpjsKetenagakerjaan.trim() || null,
      kasbon_limit: Math.max(0, Number(profile.kasbonLimit || 0)),
      notes: profile.notes.trim() || null,
      updated_at: nowIso,
    };

    const { error } = await db
      .from('employee_profiles')
      .upsert(payload, { onConflict: 'workspace_id,user_id' });

    if (error) {
      return { success: false, error: isMissingHrdTableError(error) ? migrationErr() : error.message };
    }

    revalidatePath('/hrd/employees');
    revalidatePath('/hrd/cuti');
    revalidatePath('/hrd/kasbon');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save employee profile.' };
  }
}

// ============================================================================
// 2. CUTI (LEAVE REQUESTS & APPROVALS)
// ============================================================================

export async function submitLeaveRequest(input: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: HalfDayOption;
  reason: string;
  attachmentUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };

    if (!input.startDate || !input.endDate) return { success: false, error: 'Please choose start and end dates.' };
    if (input.endDate < input.startDate) return { success: false, error: 'End date cannot be before start date.' };
    if (input.reason.trim().length < 3) return { success: false, error: 'Please write a short reason.' };

    const db = createAdminClient();

    // Load employee profile to check BOD ACC for Cuti Tahunan & Saturday half-day rule
    const { data: prof, error: profErr } = await db
      .from('employee_profiles')
      .select('cuti_eligible, annual_cuti_quota, sat_half_day')
      .eq('workspace_id', ctx.activeWorkspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle();

    if (profErr && isMissingHrdTableError(profErr)) return { success: false, error: migrationErr() };

    const satHalfDay = prof?.sat_half_day !== false;
    const daysCount = calculateWorkdays(input.startDate, input.endDate, input.halfDay, satHalfDay);
    if (daysCount <= 0) return { success: false, error: 'Selected range has 0 working days (Sunday is off).' };

    if (input.leaveType === 'tahunan') {
      if (!prof?.cuti_eligible) {
        return {
          success: false,
          error: 'Annual Cuti (Cuti Tahunan) requires BOD ACC first in Employee Directory (Nico / Herlan / Lucy).',
        };
      }
      const year = input.startDate.slice(0, 4);
      const { data: usedRows } = await db
        .from('hrd_leave_requests')
        .select('days_count')
        .eq('workspace_id', ctx.activeWorkspaceId)
        .eq('user_id', ctx.userId)
        .eq('leave_type', 'tahunan')
        .in('status', ['approved', 'pending'])
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`);

      const used = (usedRows || []).reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);
      const quota = Number(prof.annual_cuti_quota ?? 12);
      if (used + daysCount > quota) {
        return {
          success: false,
          error: `Insufficient Cuti Tahunan balance: ${Math.max(0, quota - used)} days left (requested ${daysCount} days).`,
        };
      }
    }

    const { error } = await db.from('hrd_leave_requests').insert({
      workspace_id: ctx.activeWorkspaceId,
      user_id: ctx.userId,
      leave_type: input.leaveType,
      start_date: input.startDate,
      end_date: input.endDate,
      half_day: input.startDate === input.endDate ? input.halfDay : 'none',
      days_count: daysCount,
      reason: input.reason.trim(),
      attachment_url: input.attachmentUrl?.trim() || null,
      status: 'pending',
    });

    if (error) return { success: false, error: isMissingHrdTableError(error) ? migrationErr() : error.message };

    revalidatePath('/hrd/cuti');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to submit leave request.' };
  }
}

export async function reviewLeaveRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  reviewNote?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };
    if (!isHrdBodRole(ctx.role)) {
      return { success: false, error: 'Only BOD (Founder, Superadmin, Accounting) can approve or reject leave requests.' };
    }

    const db = createAdminClient();
    const { error } = await db
      .from('hrd_leave_requests')
      .update({
        status: decision,
        reviewed_by: ctx.userId,
        reviewed_by_name: ctx.userName || ctx.userEmail || 'BOD',
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('workspace_id', ctx.activeWorkspaceId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/hrd/cuti');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update leave request.' };
  }
}

export async function cancelLeaveRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };

    const db = createAdminClient();
    const { data: row } = await db
      .from('hrd_leave_requests')
      .select('id, user_id, status')
      .eq('id', requestId)
      .eq('workspace_id', ctx.activeWorkspaceId)
      .maybeSingle();

    if (!row) return { success: false, error: 'Request not found.' };
    if (row.user_id !== ctx.userId && !isHrdBodRole(ctx.role)) {
      return { success: false, error: 'You can only cancel your own request.' };
    }
    if (row.status !== 'pending') {
      return { success: false, error: 'Only pending requests can be cancelled.' };
    }

    const { error } = await db
      .from('hrd_leave_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/hrd/cuti');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to cancel leave request.' };
  }
}

// ============================================================================
// 3. KASBON (CASH ADVANCE REQUESTS, DISBURSEMENT & INSTALLMENT LEDGER)
// ============================================================================

export async function submitKasbonRequest(input: {
  amount: number;
  installmentMonths: number;
  startDeductionMonth: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };

    const amount = Math.round(Number(input.amount || 0));
    const months = Math.max(1, Math.min(24, Math.round(Number(input.installmentMonths || 1))));
    if (amount <= 0) return { success: false, error: 'Amount must be greater than Rp 0.' };
    if (input.reason.trim().length < 3) return { success: false, error: 'Please enter a reason for the Kasbon.' };

    const monthlyInstallment = Math.ceil(amount / months);
    const db = createAdminClient();

    const { error } = await db.from('hrd_kasbon_requests').insert({
      workspace_id: ctx.activeWorkspaceId,
      user_id: ctx.userId,
      amount,
      reason: input.reason.trim(),
      installment_months: months,
      monthly_installment: monthlyInstallment,
      start_deduction_month: input.startDeductionMonth || new Date().toISOString().slice(0, 7),
      status: 'pending',
    });

    if (error) return { success: false, error: isMissingHrdTableError(error) ? migrationErr() : error.message };

    revalidatePath('/hrd/kasbon');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to submit Kasbon request.' };
  }
}

export async function reviewKasbonRequest(
  kasbonId: string,
  decision: 'approved' | 'rejected',
  reviewNote?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };
    if (!isHrdBodRole(ctx.role)) {
      return { success: false, error: 'Only BOD (Founder, Superadmin, Accounting) can approve or reject Kasbon.' };
    }

    const db = createAdminClient();
    const { error } = await db
      .from('hrd_kasbon_requests')
      .update({
        status: decision,
        reviewed_by: ctx.userId,
        reviewed_by_name: ctx.userName || ctx.userEmail || 'BOD',
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', kasbonId)
      .eq('workspace_id', ctx.activeWorkspaceId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/hrd/kasbon');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to review Kasbon.' };
  }
}

export async function markKasbonDisbursed(kasbonId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };
    if (!isHrdBodRole(ctx.role)) {
      return { success: false, error: 'Only BOD / Accounting can mark Kasbon as disbursed.' };
    }

    const db = createAdminClient();
    const { error } = await db
      .from('hrd_kasbon_requests')
      .update({
        status: 'disbursed',
        disbursed_at: new Date().toISOString(),
        disbursed_by_name: ctx.userName || ctx.userEmail || 'Accounting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', kasbonId)
      .eq('workspace_id', ctx.activeWorkspaceId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/hrd/kasbon');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to mark disbursed.' };
  }
}

export async function recordKasbonPayment(input: {
  kasbonId: string;
  amount: number;
  paymentMethod: 'payroll_deduction' | 'manual_transfer';
  payrollMonth?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };
    if (!isHrdBodRole(ctx.role)) {
      return { success: false, error: 'Only BOD / Accounting can record Kasbon repayments.' };
    }

    const payAmount = Math.round(Number(input.amount || 0));
    if (payAmount <= 0) return { success: false, error: 'Payment amount must be greater than Rp 0.' };

    const db = createAdminClient();
    const { data: kasbon, error: kErr } = await db
      .from('hrd_kasbon_requests')
      .select('*')
      .eq('id', input.kasbonId)
      .eq('workspace_id', ctx.activeWorkspaceId)
      .maybeSingle();

    if (kErr || !kasbon) return { success: false, error: 'Kasbon record not found.' };

    const { error: insertErr } = await db.from('hrd_kasbon_payments').insert({
      kasbon_id: kasbon.id,
      workspace_id: ctx.activeWorkspaceId,
      user_id: kasbon.user_id,
      amount: payAmount,
      payment_method: input.paymentMethod,
      payroll_month: input.payrollMonth || new Date().toISOString().slice(0, 7),
      notes: input.notes?.trim() || null,
      recorded_by: ctx.userId,
      recorded_by_name: ctx.userName || ctx.userEmail || 'Accounting',
    });

    if (insertErr) return { success: false, error: insertErr.message };

    const newPaid = Number(kasbon.paid_amount || 0) + payAmount;
    const totalAmount = Number(kasbon.amount || 0);
    const newInstallments = Number(kasbon.paid_installments || 0) + 1;
    const nextStatus = newPaid >= totalAmount ? 'paid_off' : 'paying';

    const { error: updErr } = await db
      .from('hrd_kasbon_requests')
      .update({
        paid_amount: Math.min(totalAmount, newPaid),
        paid_installments: newInstallments,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', kasbon.id);

    if (updErr) return { success: false, error: updErr.message };

    revalidatePath('/hrd/kasbon');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to record payment.' };
  }
}

export async function cancelKasbonRequest(kasbonId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };

    const db = createAdminClient();
    const { data: row } = await db
      .from('hrd_kasbon_requests')
      .select('id, user_id, status')
      .eq('id', kasbonId)
      .eq('workspace_id', ctx.activeWorkspaceId)
      .maybeSingle();

    if (!row) return { success: false, error: 'Kasbon request not found.' };
    if (row.user_id !== ctx.userId && !isHrdBodRole(ctx.role)) {
      return { success: false, error: 'You can only cancel your own pending Kasbon.' };
    }
    if (row.status !== 'pending') return { success: false, error: 'Only pending Kasbon can be cancelled.' };

    const { error } = await db
      .from('hrd_kasbon_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', kasbonId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/hrd/kasbon');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to cancel Kasbon.' };
  }
}
