import React, { Suspense } from 'react';
import { ShieldAlert, Users, DollarSign, CheckCircle2, Clock, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

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

  // 1. Server-Side RBAC Check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasClearance = true;

  if (user) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    // If explicitly admin (non-superadmin / non-accounting), deny access
    if (member && member.role === 'admin') {
      hasClearance = false;
    }
  }

  // 2. Render Sleek Access Denied HUD if blocked
  if (!hasClearance) {
    return (
      <div className="bg-slate-900/80 border border-red-500/40 rounded-2xl p-12 backdrop-blur-2xl text-center max-w-xl mx-auto my-12 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">
          SECURITY CLEARANCE DENIED
        </h2>
        <p className="text-xs text-slate-300 font-mono leading-relaxed mb-6">
          SALARY & BONUS TELEMETRY IS STRICTLY ENCRYPTED FOR SUPERADMIN & ACCOUNTING ROLES.
          YOUR CURRENT ROLE ('ADMIN') CAN ONLY ACCESS INCOME & EXPENSE BILLS.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
          <span>RLS GUARDRAIL: ACTIVE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
        </div>
      </div>
    );
  }

  // 3. Fetch Payroll Records
  const { data: records, error } = await supabase
    .from('payroll')
    .select('*')
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
      : [
          {
            id: '1',
            employee_name: 'Ariana Chen',
            role_title: 'Live-stream Host',
            department: 'Production',
            base_salary: 4500,
            bonus_amount: 750,
            pay_period_end: '2026-06-30',
            status: 'paid',
          },
          {
            id: '2',
            employee_name: 'Damon Vance',
            role_title: 'Video Editor',
            department: 'Creative',
            base_salary: 5200,
            bonus_amount: 300,
            pay_period_end: '2026-06-30',
            status: 'paid',
          },
          {
            id: '3',
            employee_name: 'Sophia Martinez',
            role_title: 'E-commerce Manager',
            department: 'Growth',
            base_salary: 6100,
            bonus_amount: 1200,
            pay_period_end: '2026-06-30',
            status: 'paid',
          },
          {
            id: '4',
            employee_name: 'Lucas Sterling',
            role_title: 'Live-stream Host (Part-time)',
            department: 'Production',
            base_salary: 3100,
            bonus_amount: 200,
            pay_period_end: '2026-07-31',
            status: 'draft',
          },
        ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {displayRecords.map((item) => {
        const totalPayout = item.base_salary + item.bonus_amount;
        const isPaid = item.status.toLowerCase() === 'paid';

        return (
          <div
            key={item.id}
            className="group relative bg-slate-900/70 border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)] flex flex-col justify-between"
          >
            {/* Top Personnel Header */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-sm">
                    {item.employee_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {item.employee_name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-sans">
                      {item.role_title}
                    </p>
                  </div>
                </div>

                {/* Status Dot */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase bg-slate-950/80 border border-slate-800">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPaid
                        ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                        : 'bg-amber-500 shadow-[0_0_8px_#f97316]'
                    }`}
                  />
                  <span className={isPaid ? 'text-cyan-400 font-bold' : 'text-amber-400 font-bold'}>
                    {item.status}
                  </span>
                </span>
              </div>

              {/* Department Tag */}
              <div className="mb-5">
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono uppercase">
                  DEPT: {item.department}
                </span>
              </div>

              {/* Salary & Bonus Breakdown */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Base Salary:</span>
                  <span className="text-slate-200">${item.base_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Performance Bonus:</span>
                  <span className="text-amber-400">+${item.bonus_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Bottom Total Payout */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-slate-400 uppercase block">
                  NET PAYOUT
                </span>
                <span className="text-lg font-black font-mono text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                  ${totalPayout.toLocaleString()}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-mono text-slate-500 block">PERIOD END</span>
                <span className="text-[10px] font-mono text-slate-300">
                  {item.pay_period_end}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PayrollPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>TEAM PAYROLL • PERSONNEL SALARY MATRIX</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            STRICT RLS GUARDRAILS • ACTION-ORIENTED DISBURSEMENT HUD
          </p>
        </div>

        <button
          type="button"
          title="Process Payroll Disbursement"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all transform hover:-translate-y-0.5"
        >
          <DollarSign className="w-4 h-4" />
          <span>PROCESS PAYROLL</span>
        </button>
      </div>

      {/* RSC Personnel Grid with Suspense Streaming */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            <div className="h-64 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
            <div className="h-64 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
            <div className="h-64 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
          </div>
        }
      >
        <PayrollPersonnelGrid />
      </Suspense>
    </div>
  );
}
