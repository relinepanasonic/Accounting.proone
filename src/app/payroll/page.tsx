import React, { Suspense } from 'react';
import { ShieldAlert, Users, CloudDownload, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { syncNewWavePayroll } from '@/app/actions/payroll';
import { isHrdBodRole, isMissingHrdTableError, mapDbProfile } from '@/lib/hrd/types';
import { jakartaDateIso } from '@/lib/hrd/absensi';
import { PayrollCalculator, type PayrollStaffRow } from '@/components/hrd/PayrollCalculator';

export const dynamic = 'force-dynamic';

interface PayrollRecord {
  id: string;
  employee_name: string;
  role_title: string;
  department: string;
  base_salary: number;
  bonus_amount: number;
  pay_period_end: string;
  status: string;
  notes: string;
}

async function NewWaveHourlyGrid({ month, year, activeWorkspaceId }: { month: string; year: string; activeWorkspaceId: string }) {
  const supabase = await createClient();
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

  const { data: records } = await supabase
    .from('payroll')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .gte('pay_period_end', startDate)
    .lte('pay_period_end', endDate)
    .order('employee_name', { ascending: true });

  const displayRecords: PayrollRecord[] = (records || []).map((r: any) => ({
    id: r.id,
    employee_name: r.employee_name,
    role_title: r.role_title,
    department: r.department || 'Production',
    base_salary: Number(r.base_salary || 0),
    bonus_amount: Number(r.bonus_amount || 0),
    pay_period_end: r.pay_period_end || endDate,
    status: r.status || 'paid',
    notes: r.notes || '',
  }));

  if (displayRecords.length === 0) return null;

  return (
    <div className="space-y-3 pt-4">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">New Wave Hourly Host Sync ({month}/{year})</div>
      <div className="gold-glass-panel rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/50">
              <th className="px-6 py-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Nama Host</th>
              <th className="px-6 py-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right">Tarif/Jam</th>
              <th className="px-6 py-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right">Jam Terjadwal</th>
              <th className="px-6 py-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right">Forecast Gaji</th>
              <th className="px-6 py-4 text-[9px] font-bold text-[#d4af37] uppercase tracking-wider text-right">Jam Dilaporkan</th>
              <th className="px-6 py-4 text-[9px] font-bold text-[#f5d77f] uppercase tracking-wider text-right">Gaji Aktual</th>
              <th className="px-6 py-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right">Tunjangan</th>
              <th className="px-6 py-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right">Bonus</th>
              <th className="px-6 py-4 text-[9px] font-bold text-red-400 uppercase tracking-wider text-right">Bayar Kasbon</th>
              <th className="px-6 py-4 text-[9px] font-bold text-red-400 uppercase tracking-wider text-right">Pinalti</th>
              <th className="px-6 py-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {displayRecords.map((item) => {
              let hourlyData: any = {};
              try {
                if (item.notes.startsWith('{')) hourlyData = JSON.parse(item.notes);
              } catch {}
              const isPaid = item.status.toLowerCase() === 'paid';
              return (
                <tr key={item.id} className="hover:bg-[#d4af37]/5 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-white group-hover:text-[#f5d77f]">{item.employee_name}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">Rp {Number(hourlyData.tarif_per_jam || 0).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">{Number(hourlyData.jam_terjadwal || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-500">Rp {Number(hourlyData.forecast_gaji || 0).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-[#d4af37] font-bold">{Number(hourlyData.jam_dilaporkan || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black font-mono text-[#f5d77f]">Rp {item.base_salary.toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">Rp {Number(hourlyData.tunjangan || 0).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">Rp {Number(hourlyData.bonus || 0).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-red-400/80">Rp {Number(hourlyData.bayar_kasbon || 0).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-red-400/80">Rp {Number(hourlyData.pinalti || 0).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase bg-black/70 border border-[#d4af37]/30">
                      <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-[#f5d77f]' : 'bg-[#d4af37]'}`} />
                      <span className="text-[#f5d77f] font-bold">{item.status}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function StaffPayrollSection({
  month,
  year,
  activeWorkspaceId,
  companyName,
  role,
}: {
  month: string;
  year: string;
  activeWorkspaceId: string;
  companyName: string;
  role: string;
}) {
  if (!isHrdBodRole(role)) {
    return (
      <div className="gold-glass-panel border-red-500/40 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">SECURITY CLEARANCE DENIED</h2>
        <p className="text-xs text-zinc-300 font-mono leading-relaxed">
          SALARY, COMMISSION &amp; PAYROLL TELEMETRY IS RESTRICTED TO BOD (FOUNDER, SUPERADMIN &amp; ACCOUNTING).
        </p>
      </div>
    );
  }

  const payrollMonth = `${year}-${month}`;
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const monthStart = `${payrollMonth}-01`;
  const monthEnd = `${payrollMonth}-${String(lastDay).padStart(2, '0')}`;

  const db = createAdminClient();
  let migrationRequired = false;

  const { data: members } = await db
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', activeWorkspaceId);

  const staffMembers = (members || []).filter((m: any) => m.role !== 'client' && m.user_id);
  const userIds = Array.from(new Set(staffMembers.map((m: any) => m.user_id as string)));

  const [profilesRes, hrRes, runsRes, attRes, leaveRes, kasbonRes] = await Promise.all([
    userIds.length ? db.from('profiles').select('id, full_name, email').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
    db.from('employee_profiles').select('*').eq('workspace_id', activeWorkspaceId),
    db.from('hrd_payroll_runs').select('*').eq('workspace_id', activeWorkspaceId).eq('payroll_month', payrollMonth),
    db
      .from('sales_attendance')
      .select('user_id, check_in_time, late_minutes, overtime_minutes')
      .eq('workspace_id', activeWorkspaceId)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db
      .from('hrd_leave_requests')
      .select('user_id, leave_type, days_count')
      .eq('workspace_id', activeWorkspaceId)
      .eq('status', 'approved')
      .eq('leave_type', 'unpaid')
      .lte('start_date', monthEnd)
      .gte('end_date', monthStart),
    db
      .from('hrd_kasbon_requests')
      .select('user_id, amount, paid_amount, monthly_installment, start_deduction_month, status')
      .eq('workspace_id', activeWorkspaceId)
      .in('status', ['disbursed', 'paying']),
  ]);

  if (runsRes.error && isMissingHrdTableError(runsRes.error)) {
    migrationRequired = true;
  }

  const nameByUser = new Map<string, string>(
    (profilesRes.data || []).map((p: any) => [p.id, p.full_name || p.email?.split('@')[0] || 'Staff'])
  );
  const roleByUser = new Map<string, string>(staffMembers.map((m: any) => [m.user_id, m.role]));
  const hrByUser = new Map<string, ReturnType<typeof mapDbProfile>>();
  for (const row of hrRes.data || []) hrByUser.set(row.user_id, mapDbProfile(row));
  const savedByUser = new Map<string, any>();
  for (const r of runsRes.data || []) savedByUser.set(r.user_id, r);

  const rows: PayrollStaffRow[] = userIds
    .map((uid) => {
      const prof = hrByUser.get(uid) || mapDbProfile(null);
      const saved = savedByUser.get(uid) || null;

      const uAtt = (attRes.data || []).filter((a: any) => a.user_id === uid && a.check_in_time);
      const attendanceDays = uAtt.length;
      const lateMinutes = uAtt.reduce((s: number, a: any) => s + Number(a.late_minutes || 0), 0);
      const overtimeMinutes = uAtt.reduce((s: number, a: any) => s + Number(a.overtime_minutes || 0), 0);

      const unpaidLeaveDays = (leaveRes.data || [])
        .filter((l: any) => l.user_id === uid)
        .reduce((s: number, l: any) => s + Number(l.days_count || 0), 0);

      const suggestedKasbon = (kasbonRes.data || [])
        .filter((k: any) => k.user_id === uid && (!k.start_deduction_month || k.start_deduction_month <= payrollMonth))
        .reduce((s: number, k: any) => {
          const remaining = Math.max(0, Number(k.amount || 0) - Number(k.paid_amount || 0));
          return s + Math.min(remaining, Number(k.monthly_installment || 0));
        }, 0);

      const bankInfo = prof.bankName && prof.bankAccountNo ? `${prof.bankName} ${prof.bankAccountNo}` : '';

      return {
        userId: uid,
        staffId: saved?.staff_id || prof.employeeCode || '',
        employeeName: nameByUser.get(uid) || 'Staff',
        roleTitle: prof.jobTitle || roleByUser.get(uid) || 'Staff',
        department: prof.department || '',
        bankInfo,
        baseSalary: saved ? Number(saved.base_salary || 0) : prof.baseSalary,
        allowances: saved ? Number(saved.allowances || 0) : prof.allowances,
        commissionRate: saved ? Number(saved.commission_rate || 0) : prof.commissionRate,
        commissionBase: saved ? Number(saved.commission_base || 0) : 0,
        bonusAmount: saved ? Number(saved.bonus_amount || 0) : 0,
        overtimePay: saved ? Number(saved.overtime_pay || 0) : 0,
        kasbonDeduction: saved ? Number(saved.kasbon_deduction || 0) : suggestedKasbon,
        suggestedKasbon,
        latePenalty: saved ? Number(saved.late_penalty || 0) : 0,
        unpaidLeaveDeduction: saved ? Number(saved.unpaid_leave_deduction || 0) : 0,
        otherDeduction: saved ? Number(saved.other_deduction || 0) : 0,
        attendanceDays,
        lateMinutes,
        overtimeMinutes,
        unpaidLeaveDays,
        status: (saved?.status || 'draft') as 'draft' | 'approved' | 'paid',
        notes: saved?.notes || '',
        saved: Boolean(saved),
      };
    })
    .sort((a, b) => (a.staffId || 'ZZZ').localeCompare(b.staffId || 'ZZZ', 'id', { numeric: true }) || a.employeeName.localeCompare(b.employeeName));

  return (
    <PayrollCalculator
      initialRows={rows}
      companyName={companyName}
      payrollMonth={payrollMonth}
      migrationRequired={migrationRequired}
    />
  );
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const todayWib = jakartaDateIso();

  const params = await searchParams;
  const targetMonth = params?.month && /^\d{2}$/.test(params.month) ? params.month : todayWib.slice(5, 7);
  const targetYear = params?.year && /^\d{4}$/.test(params.year) ? params.year : todayWib.slice(0, 4);

  const isNewWave = !!ctx.activeWorkspaceName?.toLowerCase().includes('new wave');
  const syncAction = syncNewWavePayroll.bind(null, targetMonth, targetYear);

  return (
    <div className="max-w-[1560px] mx-auto px-4 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-xl font-extrabold tracking-wider uppercase text-white flex items-center gap-2 font-serif">
            <Users className="w-5 h-5 text-[#d4af37]" />
            <span>Team Payroll · {ctx.activeWorkspaceName}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Per-staff salary calculator — auto-synced with Employee Directory (Gaji, Tunjangan, Komisi %), Absensi, Cuti &amp; Kasbon.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form method="GET" className="flex items-center gap-2 bg-black/40 border border-zinc-800/80 p-1.5 rounded-full px-4">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <select name="month" defaultValue={targetMonth} className="bg-transparent text-xs text-white focus:outline-none font-mono cursor-pointer [&>option]:bg-zinc-900 [&>option]:text-white">
              <option value="01">Jan</option>
              <option value="02">Feb</option>
              <option value="03">Mar</option>
              <option value="04">Apr</option>
              <option value="05">May</option>
              <option value="06">Jun</option>
              <option value="07">Jul</option>
              <option value="08">Aug</option>
              <option value="09">Sep</option>
              <option value="10">Oct</option>
              <option value="11">Nov</option>
              <option value="12">Dec</option>
            </select>
            <select name="year" defaultValue={targetYear} className="bg-transparent text-xs text-white focus:outline-none font-mono cursor-pointer ml-1 [&>option]:bg-zinc-900 [&>option]:text-white">
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
            <button type="submit" className="ml-2 text-[10px] text-[#f5d77f] hover:text-white font-bold uppercase tracking-wider">
              Filter
            </button>
          </form>

          {isNewWave && (
            <form action={syncAction}>
              <button
                type="submit"
                title="Sync from NW Apps"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs uppercase tracking-wider bg-black/40 border border-[#d4af37]/30 text-[#f5d77f] hover:bg-[#d4af37]/20 transition-all"
              >
                <CloudDownload className="w-4 h-4" />
                <span>Sync NW App</span>
              </button>
            </form>
          )}
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            <div className="gold-glass-panel rounded-2xl h-40"></div>
            <div className="gold-glass-panel rounded-2xl h-40"></div>
            <div className="gold-glass-panel rounded-2xl h-40"></div>
          </div>
        }
      >
        <StaffPayrollSection
          month={targetMonth}
          year={targetYear}
          activeWorkspaceId={ctx.activeWorkspaceId}
          companyName={ctx.activeWorkspaceName}
          role={ctx.role}
        />
        {isNewWave && (
          <NewWaveHourlyGrid month={targetMonth} year={targetYear} activeWorkspaceId={ctx.activeWorkspaceId} />
        )}
      </Suspense>
    </div>
  );
}
