'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isHrdBodRole, isMissingHrdTableError } from '@/lib/hrd/types';

export interface SavePayrollRunInput {
  userId: string;
  payrollMonth: string; // YYYY-MM
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
  latePenalty: number;
  unpaidLeaveDeduction: number;
  otherDeduction: number;
  attendanceDays: number;
  lateMinutes: number;
  overtimeMinutes: number;
  unpaidLeaveDays: number;
  status: 'draft' | 'approved' | 'paid';
  notes?: string;
}

export async function saveStaffPayrollRun(
  input: SavePayrollRunInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!ctx.userId || !ctx.activeWorkspaceId) return { success: false, error: 'Please sign in again.' };
    if (!isHrdBodRole(ctx.role)) {
      return { success: false, error: 'Only BOD (Founder, Superadmin, Accounting) can save payroll calculations.' };
    }

    const baseSalary = Math.max(0, Math.round(Number(input.baseSalary || 0)));
    const allowances = Math.max(0, Math.round(Number(input.allowances || 0)));
    const commissionRate = Math.max(0, Math.min(100, Number(input.commissionRate || 0)));
    const commissionBase = Math.max(0, Math.round(Number(input.commissionBase || 0)));
    const commissionAmount = Math.round((commissionBase * commissionRate) / 100);
    const bonusAmount = Math.max(0, Math.round(Number(input.bonusAmount || 0)));
    const overtimePay = Math.max(0, Math.round(Number(input.overtimePay || 0)));

    const kasbonDeduction = Math.max(0, Math.round(Number(input.kasbonDeduction || 0)));
    const latePenalty = Math.max(0, Math.round(Number(input.latePenalty || 0)));
    const unpaidLeaveDeduction = Math.max(0, Math.round(Number(input.unpaidLeaveDeduction || 0)));
    const otherDeduction = Math.max(0, Math.round(Number(input.otherDeduction || 0)));

    const grossSalary = baseSalary + allowances + commissionAmount + bonusAmount + overtimePay;
    const totalDeductions = kasbonDeduction + latePenalty + unpaidLeaveDeduction + otherDeduction;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    const db = createAdminClient();
    const nowIso = new Date().toISOString();

    const { error } = await db.from('hrd_payroll_runs').upsert(
      {
        workspace_id: ctx.activeWorkspaceId,
        user_id: input.userId,
        payroll_month: input.payrollMonth,
        staff_id: input.staffId || null,
        employee_name: input.employeeName,
        role_title: input.roleTitle || null,
        department: input.department || null,
        bank_info: input.bankInfo || null,
        base_salary: baseSalary,
        allowances,
        commission_rate: commissionRate,
        commission_base: commissionBase,
        commission_amount: commissionAmount,
        bonus_amount: bonusAmount,
        overtime_pay: overtimePay,
        kasbon_deduction: kasbonDeduction,
        late_penalty: latePenalty,
        unpaid_leave_deduction: unpaidLeaveDeduction,
        other_deduction: otherDeduction,
        gross_salary: grossSalary,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        attendance_days: Math.max(0, Math.round(Number(input.attendanceDays || 0))),
        late_minutes: Math.max(0, Math.round(Number(input.lateMinutes || 0))),
        overtime_minutes: Math.max(0, Math.round(Number(input.overtimeMinutes || 0))),
        unpaid_leave_days: Math.max(0, Number(input.unpaidLeaveDays || 0)),
        status: input.status,
        notes: input.notes?.trim() || null,
        paid_at: input.status === 'paid' ? nowIso : null,
        updated_by: ctx.userName || ctx.userEmail || 'BOD',
        updated_at: nowIso,
      },
      { onConflict: 'workspace_id,user_id,payroll_month' }
    );

    if (error) {
      return {
        success: false,
        error: isMissingHrdTableError(error)
          ? 'Run supabase/migrations/20261215_hrd_payroll_commission.sql in Supabase SQL Editor first.'
          : error.message,
      };
    }

    revalidatePath('/payroll');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save payroll calculation.' };
  }
}

export async function saveAllPayrollRuns(
  items: SavePayrollRunInput[]
): Promise<{ success: boolean; savedCount?: number; error?: string }> {
  try {
    let savedCount = 0;
    for (const item of items) {
      const res = await saveStaffPayrollRun(item);
      if (!res.success) return { success: false, error: res.error };
      savedCount += 1;
    }
    return { success: true, savedCount };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save all payroll rows.' };
  }
}
