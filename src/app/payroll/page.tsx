import React, { Suspense } from 'react';
import { ShieldAlert, Users, DollarSign, CloudDownload, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { syncNewWavePayroll } from '@/app/actions/payroll';

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

async function PayrollPersonnelGrid({ month, year, isNewWave, activeWorkspaceId }: { month: string; year: string; isNewWave: boolean; activeWorkspaceId: string }) {
  const supabase = await createClient();

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
      </div>
    );
  }

  const startDate = `${year}-${month}-01`;
  const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

  const { data: records } = await supabase
    .from('payroll')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .gte('pay_period_end', startDate)
    .lte('pay_period_end', endDate)
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
          notes: r.notes || '',
        }))
      : [];

  if (displayRecords.length === 0) {
    return (
      <div className="gold-glass-panel rounded-2xl p-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
          <span className="font-bold text-lg">$</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Payroll Records for {month}/{year}</h3>
          <p className="text-xs text-zinc-400 font-sans mt-1">Personnel compensation and creator payout telemetry will display here once added or synced.</p>
        </div>
      </div>
    );
  }

  if (isNewWave) {
    // New Wave Hourly Format
    return (
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
                if (item.notes.startsWith('{')) {
                  hourlyData = JSON.parse(item.notes);
                }
              } catch (e) {}

              const isPaid = item.status.toLowerCase() === 'paid';

              return (
                <tr key={item.id} className="hover:bg-[#d4af37]/5 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-white group-hover:text-[#f5d77f] transition-colors">
                    {item.employee_name}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">
                    Rp {Number(hourlyData.tarif_per_jam || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">
                    {Number(hourlyData.jam_terjadwal || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-500">
                    Rp {Number(hourlyData.forecast_gaji || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-[#d4af37] font-bold">
                    {Number(hourlyData.jam_dilaporkan || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-black font-mono text-[#f5d77f] drop-shadow-[0_0_8px_rgba(245,215,127,0.3)]">
                    Rp {item.base_salary.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">
                    Rp {Number(hourlyData.tunjangan || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400">
                    Rp {Number(hourlyData.bonus || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-red-400/80">
                    Rp {Number(hourlyData.bayar_kasbon || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-red-400/80">
                    Rp {Number(hourlyData.pinalti || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase bg-black/70 border border-[#d4af37]/30">
                      <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-[#f5d77f] shadow-[0_0_8px_#f5d77f]' : 'bg-[#d4af37] shadow-[0_0_8px_#d4af37]'}`} />
                      <span className="text-[#f5d77f] font-bold">{item.status}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Standard Format
  return (
    <div className="gold-glass-panel rounded-2xl overflow-x-auto">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950/50">
            <th className="px-6 py-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Personnel</th>
            <th className="px-6 py-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Dept</th>
            <th className="px-6 py-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider text-right">Base Salary</th>
            <th className="px-6 py-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider text-right">Bonus</th>
            <th className="px-6 py-4 text-[10px] font-mono text-[#d4af37] uppercase tracking-wider text-right">Net Payout</th>
            <th className="px-6 py-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider text-center">Period End</th>
            <th className="px-6 py-4 text-[10px] font-mono text-zinc-400 uppercase tracking-wider text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {displayRecords.map((item) => {
            const totalPayout = item.base_salary + item.bonus_amount;
            const isPaid = item.status.toLowerCase() === 'paid';
            
            return (
              <tr key={item.id} className="hover:bg-[#d4af37]/5 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#f5d77f] via-[#d4af37] to-[#997319] flex items-center justify-center font-black text-black text-xs shadow-[0_0_15px_rgba(212,175,55,0.2)] shrink-0">
                      {item.employee_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-[#f5d77f] transition-colors">{item.employee_name}</h3>
                      <p className="text-[11px] text-zinc-400 font-sans">{item.role_title}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] px-2.5 py-0.5 rounded bg-zinc-900/90 text-[#d4af37] font-mono uppercase border border-[#d4af37]/20">
                    {item.department}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-xs font-mono text-zinc-300">
                  Rp {item.base_salary.toLocaleString('id-ID')}
                </td>
                <td className="px-6 py-4 text-right text-xs font-mono text-[#f5d77f]">
                  {item.bonus_amount > 0 ? `+Rp ${item.bonus_amount.toLocaleString('id-ID')}` : '-'}
                </td>
                <td className="px-6 py-4 text-right text-sm font-black font-mono text-[#f5d77f] drop-shadow-[0_0_8px_rgba(245,215,127,0.3)]">
                  Rp {totalPayout.toLocaleString('id-ID')}
                </td>
                <td className="px-6 py-4 text-center text-[10px] font-mono text-zinc-400">
                  {item.pay_period_end}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase bg-black/70 border border-[#d4af37]/30">
                    <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-[#f5d77f] shadow-[0_0_8px_#f5d77f]' : 'bg-[#d4af37] shadow-[0_0_8px_#d4af37]'}`} />
                    <span className="text-[#f5d77f] font-bold">{item.status}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PayrollPage({ searchParams }: { searchParams: { month?: string, year?: string } }) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  // Check if New Wave
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', activeWorkspaceId)
    .single();
  const isNewWave = !!workspace?.name?.toLowerCase().includes('new wave');

  // Default to January 2026 for demonstration if not provided
  const targetMonth = searchParams.month || '01';
  const targetYear = searchParams.year || '2026';

  const syncAction = syncNewWavePayroll.bind(null, targetMonth, targetYear);

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

        <div className="flex items-center gap-3">
          {/* Month Filter Form */}
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
                className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider bg-black/40 border border-[#d4af37]/30 text-[#f5d77f] hover:bg-[#d4af37]/20 transition-all"
              >
                <CloudDownload className="w-4 h-4" />
                <span>SYNC NW APP</span>
              </button>
            </form>
          )}

          <button
            type="button"
            title="Process Payroll Disbursement"
            className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider"
          >
            <DollarSign className="w-4 h-4" />
            <span>PROCESS</span>
          </button>
        </div>
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
        <PayrollPersonnelGrid month={targetMonth} year={targetYear} isNewWave={isNewWave} activeWorkspaceId={activeWorkspaceId} />
      </Suspense>
    </div>
  );
}
