import React, { Suspense } from 'react';
import { LeftColumnHUD } from '@/components/dashboard/LeftColumnHUD';
import { CenterColumnHUD } from '@/components/dashboard/CenterColumnHUD';
import { RightColumnHUD } from '@/components/dashboard/RightColumnHUD';
import { ActionFooterBar } from '@/components/dashboard/footer/ActionFooterBar';

export const dynamic = 'force-dynamic';

const ColumnSkeleton = () => (
  <div className="flex flex-col gap-6 animate-pulse">
    <div className="gold-glass-panel rounded-2xl h-60"></div>
    <div className="gold-glass-panel rounded-2xl h-64"></div>
    <div className="gold-glass-panel rounded-2xl h-48"></div>
  </div>
);

export default async function CyberneticAccountingDashboardRSC() {
  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-100 font-sans selection:bg-[#d4af37] selection:text-black relative overflow-hidden">
      {/* Ambient Brushed Gold & Warm Radial Glows */}
      <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-[#d4af37]/8 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[500px] bg-[#f5d77f]/8 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 relative z-10 flex flex-col min-h-screen justify-between">
        {/* Executive Luxury Header */}
        <header className="flex items-center justify-between pb-6 mb-6 border-b border-[#d4af37]/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f5d77f] via-[#d4af37] to-[#997319] flex items-center justify-center font-black text-black text-xs shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              PRO
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase text-white">
                Advance Accounting & Invoice Generator • Luxury Executive Suite
              </h1>
              <p className="text-[11px] text-[#d4af37] font-mono">
                RSC SERVER STREAMING • LUXURY OBSIDIAN PANELS • ZERO ACCOUNTING JARGON
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37]/10 text-[#f5d77f] border border-[#d4af37]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-ping"></span>
              BRUSHED GOLD TELEMETRY READY
            </span>
          </div>
        </header>

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

        {/* Action Footer */}
        <ActionFooterBar />
      </div>
    </div>
  );
}
