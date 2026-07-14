import React, { Suspense } from 'react';
import { ShieldAlert, Users, DollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

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
}

async function PayrollPersonnelGrid() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasClearance = true;

  if (user) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', activeWorkspaceId)
      .limit(1)
      .single();

    if (member && member.role === 'admin') {
      hasClearance = false;
    }
  }

  if (!hasClearance) {
    return (
      <div className="gold-glass-panel border-red-500/40 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">
          SECURITY CLEARANCE DENIED
        </h2>
        <p className="text-xs text-zinc-300 font-mono leading-relaxed mb-6">
          SALARY & BONUS TELEMETRY IS STRICTLY RESTRICTED TO SUPERADMIN & ACCOUNTING ROLES.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border border-zinc-800 text-[10px] font-mono text-zinc-400">
          <span>RLS GUARDRAIL: ACTIVE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
        </div>
      </div>
    );
  }

  const { data: records } = await supabase
    .from('payroll')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .order('employee_name', { ascending: true });

  const displayRecords: PayrollRecord[] =
    records && records.length > 0
      ? records.map((r) => ({
          id: r.id,
          employee_name: r.employee_name,
          role_title: r.role_title,
          department: r.department || 'Production',
          base_salary: Number(r.base_salary || 0),
          bonus_amount: Number(r.bonus_amount || 0),
          pay_period_end: r.pay_period_end || '2026-06-30',
          status: r.status || 'paid',
        }))
      : [];

  return (
    <div>
      {displayRecords.length === 0 ? (
        <div className="gold-glass-panel rounded-2xl p-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
            <span className="font-bold text-lg">$</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Payroll Records Posted Yet</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">Personnel compensation and creator payout telemetry will display here once added.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayRecords.map((item) => {
        const totalPayout = item.base_salary + item.bonus_amount;
        const isPaid = item.status.toLowerCase() === 'paid';

        return (
          <div
            key={item.id}
            className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 flex flex-col justify-between"
          >
            {/* Top Personnel Header */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#f5d77f] via-[#d4af37] to-[#997319] flex items-center justify-center font-black text-black text-sm shadow-[0_0_15px_rgba(212,175,55,0.35)]">
                    {item.employee_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#f5d77f] transition-colors">
                      {item.employee_name}
                    </h3>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      {item.role_title}
                    </p>
                  </div>
                </div>

                {/* Status Dot in Brushed Gold */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase bg-black/70 border border-[#d4af37]/30">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPaid
                        ? 'bg-[#f5d77f] shadow-[0_0_8px_#f5d77f]'
                        : 'bg-[#d4af37] shadow-[0_0_8px_#d4af37]'
                    }`}
                  />
                  <span className="text-[#f5d77f] font-bold">
                    {item.status}
                  </span>
                </span>
              </div>

              {/* Department Tag */}
              <div className="mb-5">
                <span className="text-[10px] px-2.5 py-0.5 rounded bg-zinc-900/90 text-[#d4af37] font-mono uppercase border border-[#d4af37]/20">
                  DEPT: {item.department}
                </span>
              </div>

              {/* Salary & Bonus Breakdown */}
              <div className="space-y-2 p-3 rounded-xl bg-black/50 border border-zinc-800/80 font-mono text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Base Salary:</span>
                  <span className="text-zinc-200">Rp {item.base_salary.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Performance Bonus:</span>
                  <span className="text-[#f5d77f]">+Rp {item.bonus_amount.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Bottom Total Payout */}
            <div className="mt-6 pt-4 border-t border-[#d4af37]/20 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-zinc-400 uppercase block">
                  NET PAYOUT
                </span>
                <span className="text-lg font-black font-mono text-[#f5d77f] drop-shadow-[0_0_10px_rgba(245,215,127,0.45)]">
                  Rp {totalPayout.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-mono text-zinc-500 block">PERIOD END</span>
                <span className="text-[10px] font-mono text-zinc-300">
                  {item.pay_period_end}
                </span>
              </div>
            </div>
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}

export default function PayrollPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#d4af37]" />
            <span>TEAM PAYROLL • LUXURY PERSONNEL MATRIX</span>
          </h1>
          <p className="text-xs text-[#d4af37] font-mono">
            STRICT RLS CLEARANCE • BRUSHED GOLD EXECUTIVE SALARY HUD
          </p>
        </div>

        <button
          type="button"
          title="Process Payroll Disbursement"
          className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider"
        >
          <DollarSign className="w-4 h-4" />
          <span>PROCESS PAYROLL</span>
        </button>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            <div className="gold-glass-panel rounded-2xl h-64"></div>
            <div className="gold-glass-panel rounded-2xl h-64"></div>
            <div className="gold-glass-panel rounded-2xl h-64"></div>
          </div>
        }
      >
        <PayrollPersonnelGrid />
      </Suspense>
    </div>
  );
}
