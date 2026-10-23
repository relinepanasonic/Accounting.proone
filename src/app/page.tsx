import React, { Suspense } from 'react';
import Link from 'next/link';
import { Building2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { getDashboardTelemetry } from '@/lib/data/dashboard';
import { DashboardFilterBar } from '@/components/dashboard/DashboardFilterBar';

import { DashboardTopNumbers } from '@/components/dashboard/center-column/DashboardTopNumbers';
import { DashboardBottomNumbers } from '@/components/dashboard/center-column/DashboardBottomNumbers';
import { DashboardChartsRow3Lazy as DashboardChartsRow3 } from '@/components/dashboard/center-column/DashboardChartsRow3Lazy';
import { DashboardChartsRow4Lazy as DashboardChartsRow4 } from '@/components/dashboard/center-column/DashboardChartsRow4Lazy';
import { DashboardTablesRow5 } from '@/components/dashboard/center-column/DashboardTablesRow5';

export const dynamic = 'force-dynamic';

const ColumnSkeleton = () => (
  <div className="flex flex-col gap-6 animate-pulse">
    <div className="gold-glass-panel rounded-2xl h-32"></div>
    <div className="gold-glass-panel rounded-2xl h-32"></div>
    <div className="gold-glass-panel rounded-2xl h-64"></div>
  </div>
);

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string; company?: string }>;
}

export default async function CyberneticAccountingDashboardRSC({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthFilter = params?.month ? parseInt(params.month, 10) : null;
  const wsContext = await getAuthenticatedWorkspaceContext();
  const yearNum = params?.year ? parseInt(params.year, 10) : NaN;
  const year = Number.isFinite(yearNum) && yearNum > 2000 && yearNum < 2100 ? yearNum : new Date().getFullYear();
  const company = (params?.company || '').slice(0, 60);
  const telemetry = await getDashboardTelemetry({ monthFilter, year, company, ctx: wsContext });
  const userName = wsContext.userName || 'Executive';
  const activeWorkspaceName = wsContext.activeWorkspaceName || 'Professor Toko Online HQ';
  const supabase = await createClient();

  // The Schedule Expense of the assets: warn only when a payment is due (its day has come) and is not in the ledger yet.
  let needsDepreciation = false;
  {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const { data: dueLines, error } = await supabase
      .from('asset_schedule')
      .select('id')
      .eq('workspace_id', wsContext.activeWorkspaceId)
      .is('posted_at', null)
      .lte('due_date', today)
      .limit(1);
    if (!error && dueLines && dueLines.length > 0) needsDepreciation = true;
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-100 font-sans selection:bg-[#d4af37] selection:text-black relative overflow-hidden">
      {/* Ambient Brushed Gold & Warm Radial Glows */}
      <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-[#d4af37]/8 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[500px] bg-[#f5d77f]/8 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 relative z-10 flex flex-col min-h-screen justify-between">
        <div>
          {/* Executive Welcome Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#d4af37]/20">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white font-serif">
                Welcome, <span className="text-[#f5d77f]">{userName}</span>
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#18233c]/80 to-black border border-[#d4af37] text-[#f5d77f] font-mono text-xs font-bold shadow-[0_0_20px_rgba(212,175,55,0.25)]">
                  <Building2 className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>ACTIVE TENANT: <span className="text-white font-sans uppercase font-extrabold">{activeWorkspaceName}</span></span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider hidden md:inline">
                  • VERIFIED ISOLATION MATRIX
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
            </div>
          </header>

          <div className="mb-6">
            <DashboardFilterBar year={year} years={telemetry.availableYears || [year]} companies={wsContext.activeWorkspaceId === '11111111-1111-1111-1111-111111111111' ? [] : telemetry.companyOptions || []} />
          </div>

          {needsDepreciation && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-transparent border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(239,68,68,0.15)] relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
              <div className="flex items-center gap-4 pl-2">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/40">
                  <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-red-400 uppercase tracking-widest flex items-center gap-2">
                    Monthly Depreciation Required
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-[9px] font-mono border border-red-500/30">ACTION NEEDED</span>
                  </h3>
                  <p className="text-xs text-red-300/70 mt-1 font-sans">You have active fixed assets that haven't been depreciated for this month.</p>
                </div>
              </div>
              <Link href="/assets" className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500 text-red-100 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-red-500/50 hover:border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center justify-center whitespace-nowrap">
                Run Now
              </Link>
            </div>
          )}

          {/* V2 DASHBOARD LAYOUT */}
          <Suspense fallback={<ColumnSkeleton />}>
            {/* ROW 1 */}
            <DashboardTopNumbers telemetry={telemetry} />
            
            {/* ROW 2 */}
            <DashboardBottomNumbers telemetry={telemetry} />
            
            {/* ROW 3 */}
            <DashboardChartsRow3 telemetry={telemetry} />
            
            {/* ROW 4 */}
            <DashboardChartsRow4 telemetry={telemetry} />
            
            {/* ROW 5 */}
            <DashboardTablesRow5 telemetry={telemetry} />
          </Suspense>
        </div>

        {/* Minimal Executive Footer */}
        <footer className="mt-12 pt-6 border-t border-[#d4af37]/15 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-zinc-500">
          <div>
            ADVANCE ACCOUNTING & INVOICE GENERATOR • IDR REALTIME PARITY ENGINE
          </div>
          <div>
            SYSTEM STATUS: <span className="text-[#f5d77f]">OPTIMAL • 100% CLEARANCE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
