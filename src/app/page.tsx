import React, { Suspense } from 'react';
import Link from 'next/link';
import { Settings, Plus, Receipt, Building2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DashboardStatsCards } from '@/components/dashboard/header/DashboardStatsCards';
import { DashboardRow1 } from '@/components/dashboard/center-column/DashboardRow1';
import { DashboardRow2 } from '@/components/dashboard/center-column/DashboardRow2';
import { DashboardRow3 } from '@/components/dashboard/center-column/DashboardRow3';
import { ClientAnalyticsTable } from '@/components/dashboard/center-column/ClientAnalyticsTable';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { getDashboardTelemetry } from '@/lib/data/dashboard';
import { MonthFilter } from '@/components/dashboard/MonthFilter';

export const dynamic = 'force-dynamic';

const ColumnSkeleton = () => (
  <div className="flex flex-col gap-6 animate-pulse">
    <div className="gold-glass-panel rounded-2xl h-60"></div>
    <div className="gold-glass-panel rounded-2xl h-64"></div>
    <div className="gold-glass-panel rounded-2xl h-48"></div>
  </div>
);

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function CyberneticAccountingDashboardRSC({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthFilter = params?.month ? parseInt(params.month, 10) : null;
  const wsContext = await getAuthenticatedWorkspaceContext();
  const telemetry = await getDashboardTelemetry({ monthFilter });
  const userName = wsContext.userName || 'Executive';
  const activeWorkspaceName = wsContext.activeWorkspaceName || 'Professor Toko Online HQ';
  const supabase = await createClient();

  // Check if depreciation needs running
  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7); // '2026-08'
  const { data: assets } = await supabase
    .from('fixed_assets')
    .select('id, annual_depreciation')
    .eq('workspace_id', wsContext.activeWorkspaceId)
    .eq('status', 'active');
  
  let needsDepreciation = false;
  if (assets && assets.length > 0) {
    const { data: existingDepr } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('workspace_id', wsContext.activeWorkspaceId)
      .like('reference_id', `depr-%-${currentMonthStr}`)
      .limit(1);
    
    if (!existingDepr || existingDepr.length === 0) {
      // Check if any of these assets actually have annual_depreciation > 0
      if (assets.some((a: any) => Number(a.annual_depreciation) > 0)) {
        needsDepreciation = true;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-100 font-sans selection:bg-[#d4af37] selection:text-black relative overflow-hidden">
      {/* Ambient Brushed Gold & Warm Radial Glows */}
      <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-[#d4af37]/8 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[500px] bg-[#f5d77f]/8 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 relative z-10 flex flex-col min-h-screen justify-between">
        <div>
          {/* Executive Welcome Header (Pic 3 Replacement) */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#d4af37]/20">
            {/* Left Side: Welcome, user - Name Workspace */}
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

            {/* Right Side: Quick Actions, Setting (gear Icon), and Photo of user */}
            <div className="flex items-center gap-3 self-start sm:self-center">
              <Link
                href="/invoices/new"
                className="gold-btn hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform hover:scale-105"
              >
                <Plus className="w-4 h-4 text-black" />
                <span>NEW INVOICE</span>
              </Link>

              <Link
                href="/expenses/new"
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 border border-[#d4af37]/50 hover:bg-[#d4af37]/15 text-[#f5d77f] font-extrabold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-transform hover:scale-105"
              >
                <Receipt className="w-4 h-4" />
                <span>RECORD EXPENSE</span>
              </Link>

              {/* Setting (gear Icon) */}
              <Link
                href="/settings"
                title="Workspace & User Settings"
                className="w-11 h-11 rounded-2xl gold-glass-panel border border-[#d4af37]/50 hover:border-[#d4af37] flex items-center justify-center text-[#f5d77f] hover:scale-105 transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] shrink-0"
              >
                <Settings className="w-5 h-5" />
              </Link>

              {/* Photo of user / Avatar */}
              <Link
                href="/settings/workspaces"
                title={`Logged in as ${userName}`}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#18233c] via-[#d4af37] to-[#f5d77f] p-0.5 shadow-[0_0_25px_rgba(212,175,55,0.35)] flex items-center justify-center overflow-hidden shrink-0 group transition-transform hover:scale-105"
              >
                <div className="w-full h-full rounded-[14px] bg-[#0b0c10] group-hover:bg-[#18233c] transition-colors flex items-center justify-center text-sm font-extrabold font-serif text-[#f5d77f]">
                  {userName.substring(0, 2).toUpperCase()}
                </div>
              </Link>
              {/* New Month Filter Component */}
              <MonthFilter />
            </div>
          </header>

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

          {/* TOP EXECUTIVE STATS BAR WITH MINI SPARKLINES (NUMBERS) */}
          <DashboardStatsCards telemetry={telemetry} />

          {/* V2 DASHBOARD STACKED ROWS */}
          <Suspense fallback={<ColumnSkeleton />}>
            <DashboardRow1 telemetry={telemetry} />
            <DashboardRow2 telemetry={telemetry} />
            <DashboardRow3 telemetry={telemetry} />
            <ClientAnalyticsTable telemetry={telemetry} />
          </Suspense>
        </div>

        {/* Minimal Executive Footer (No Buttons or Numbers Strip) */}
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
