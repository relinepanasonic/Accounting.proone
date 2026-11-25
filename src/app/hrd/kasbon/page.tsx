import React from 'react';
import { Banknote, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isHrdBodRole, isMissingHrdTableError, mapDbProfile } from '@/lib/hrd/types';
import { KasbonBoard, type KasbonPaymentRow, type KasbonRow } from '@/components/hrd/KasbonBoard';

export const dynamic = 'force-dynamic';

export default async function KasbonPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.userId || !ctx.activeWorkspaceId || ctx.role === 'none' || ctx.role === 'client') {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Please sign in with a company staff account to access Kasbon.</p>
      </div>
    );
  }

  const isBod = isHrdBodRole(ctx.role);
  const db = createAdminClient();
  let migrationRequired = false;

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

  // Load HR profiles for bank info & kasbon limits
  const hrProfileByUser = new Map<string, ReturnType<typeof mapDbProfile>>();
  const hrRes = await db.from('employee_profiles').select('*').eq('workspace_id', ctx.activeWorkspaceId);
  if (hrRes.error) {
    if (isMissingHrdTableError(hrRes.error)) migrationRequired = true;
  } else {
    for (const row of hrRes.data || []) hrProfileByUser.set(row.user_id, mapDbProfile(row));
  }

  let rawKasbons: any[] = [];
  let rawPayments: any[] = [];
  if (!migrationRequired) {
    const kRes = await db
      .from('hrd_kasbon_requests')
      .select('*')
      .eq('workspace_id', ctx.activeWorkspaceId)
      .order('created_at', { ascending: false })
      .limit(300);

    if (kRes.error) {
      if (isMissingHrdTableError(kRes.error)) migrationRequired = true;
    } else {
      rawKasbons = kRes.data || [];
    }

    if (!migrationRequired && rawKasbons.length > 0) {
      const pRes = await db
        .from('hrd_kasbon_payments')
        .select('*')
        .eq('workspace_id', ctx.activeWorkspaceId)
        .order('payment_date', { ascending: false });
      if (!pRes.error) rawPayments = pRes.data || [];
    }
  }

  const paymentsByKasbon = new Map<string, KasbonPaymentRow[]>();
  for (const p of rawPayments) {
    const list = paymentsByKasbon.get(p.kasbon_id) || [];
    list.push({
      id: p.id,
      amount: Number(p.amount || 0),
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      payrollMonth: p.payroll_month || '',
      notes: p.notes || '',
      recordedByName: p.recorded_by_name || '',
    });
    paymentsByKasbon.set(p.kasbon_id, list);
  }

  const kasbons: KasbonRow[] = rawKasbons.map((r) => {
    const prof = hrProfileByUser.get(r.user_id) || mapDbProfile(null);
    const amount = Number(r.amount || 0);
    const paidAmount = Number(r.paid_amount || 0);
    return {
      id: r.id,
      userId: r.user_id,
      employeeName: nameByUser.get(r.user_id) || 'Staff',
      department: prof.department,
      bankInfo: prof.bankName && prof.bankAccountNo ? `${prof.bankName} · ${prof.bankAccountNo}` : '',
      kasbonLimit: prof.kasbonLimit,
      amount,
      reason: r.reason || '',
      installmentMonths: Number(r.installment_months || 1),
      monthlyInstallment: Number(r.monthly_installment || amount),
      paidAmount,
      remainingAmount: Math.max(0, amount - paidAmount),
      paidInstallments: Number(r.paid_installments || 0),
      startDeductionMonth: r.start_deduction_month || '',
      status: r.status,
      reviewedByName: r.reviewed_by_name || '',
      reviewNote: r.review_note || '',
      disbursedAt: r.disbursed_at || null,
      disbursedByName: r.disbursed_by_name || '',
      createdAt: r.created_at,
      payments: paymentsByKasbon.get(r.id) || [],
    };
  });

  const myProfile = hrProfileByUser.get(ctx.userId) || mapDbProfile(null);

  return (
    <div className="space-y-6 p-4 lg:p-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-[#d4af37]/10 p-3 text-[#d4af37]">
          <Banknote className="h-7 w-7" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-zinc-100">Kasbon Karyawan</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {ctx.activeWorkspaceName} · Employee cash advance requests, BOD approvals, disbursement &amp; cicilan ledger.
          </p>
        </div>
      </div>

      <KasbonBoard
        kasbons={kasbons}
        currentUserId={ctx.userId}
        myKasbonLimit={myProfile.kasbonLimit}
        myBaseSalary={myProfile.baseSalary}
        isBod={isBod}
        migrationRequired={migrationRequired}
      />
    </div>
  );
}
