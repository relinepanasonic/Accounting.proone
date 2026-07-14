import React, { Suspense } from 'react';
import Link from 'next/link';
import { Settings, Plus, Receipt, Building2 } from 'lucide-react';
import { LeftColumnHUD } from '@/components/dashboard/LeftColumnHUD';
import { CenterColumnHUD } from '@/components/dashboard/CenterColumnHUD';
import { RightColumnHUD } from '@/components/dashboard/RightColumnHUD';
import { TopExecutiveStatsBar } from '@/components/dashboard/header/TopExecutiveStatsBar';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export const dynamic = 'force-dynamic';

const ColumnSkeleton = () => (
  <div className="flex flex-col gap-6 animate-pulse">
    <div className="gold-glass-panel rounded-2xl h-60"></div>
    <div className="gold-glass-panel rounded-2xl h-64"></div>
    <div className="gold-glass-panel rounded-2xl h-48"></div>
  </div>
);

export default async function CyberneticAccountingDashboardRSC() {
  const wsContext = await getAuthenticatedWorkspaceContext();
  const userName = wsContext.userName || 'Executive';
  const activeWorkspaceName = wsContext.activeWorkspaceName || 'Professor Toko Online HQ';

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
            </div>
          </header>

          {/* TOP EXECUTIVE STATS BAR WITH MINI SPARKLINES & ACTION BUTTONS */}
          <TopExecutiveStatsBar />

          {/* 3-COLUMN MODULAR LUXURY HUD GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            {/* COLUMN 1: LEFT HUD PANEL */}
            <Suspense fallback={<ColumnSkeleton />}>
              <LeftColumnHUD />
            </Suspense>

            {/* COLUMN 2: CENTER DATA CORE */}
            <Suspense fallback={<ColumnSkeleton />}>
              <CenterColumnHUD />
            </Suspense>

            {/* COLUMN 3: RIGHT HUD PANEL */}
            <Suspense fallback={<ColumnSkeleton />}>
              <RightColumnHUD />
            </Suspense>
          </div>
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
