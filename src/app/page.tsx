import React, { Suspense } from 'react';
import { LeftColumnHUD } from '@/components/dashboard/LeftColumnHUD';
import { CenterColumnHUD } from '@/components/dashboard/CenterColumnHUD';
import { RightColumnHUD } from '@/components/dashboard/RightColumnHUD';
import { ActionFooterBar } from '@/components/dashboard/footer/ActionFooterBar';

export const dynamic = 'force-dynamic';

const ColumnSkeleton = () => (
  <div className="flex flex-col gap-6 animate-pulse">
    <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-60"></div>
    <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-64"></div>
    <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-48"></div>
  </div>
);

export default async function CyberneticAccountingDashboardRSC() {
  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      {/* Ambient Cybernetic HUD Glows */}
      <div className="absolute top-[-10%] left-[15%] w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[15%] w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[130px] pointer-events-none"></div>

      {/* Main HUD Container */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 relative z-10 flex flex-col min-h-screen justify-between">
        {/* Instant Server Shell Header */}
        <header className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-cyan-600 flex items-center justify-center font-black text-black text-xs shadow-[0_0_12px_rgba(34,211,238,0.5)]">
              AGY
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase text-white">
                Advance Accounting & Invoice Generator HUD
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                RSC SERVER STREAMING • CODE-SPLIT LEAF VISUALS • INDEXED RLS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              STREAMING RSC EDGE READY
            </span>
          </div>
        </header>

        {/* 3-COLUMN MODULAR HUD GRID STREAMING VIA SUSPENSE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* COLUMN 1: LEFT HUD PANEL */}
          <Suspense fallback={<ColumnSkeleton />}>
            <LeftColumnHUD />
          </Suspense>

          {/* COLUMN 2: CENTER DATA CORE */}
          <Suspense fallback={<ColumnSkeleton />}>
            <CenterColumnHUD />
          </Suspense>

          {/* COLUMN 3: RIGHT A/P & HEALTH PANEL */}
          <Suspense fallback={<ColumnSkeleton />}>
            <RightColumnHUD />
          </Suspense>
        </div>

        {/* BOTTOM ACTION BAR */}
        <ActionFooterBar />
      </div>
    </div>
  );
}
