'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Skeletons to prevent layout shift while heavy SVG/visuals load on client
const ChartSkeleton = () => (
  <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl h-56 p-5 animate-pulse flex flex-col justify-between">
    <div className="h-3 w-1/3 bg-slate-800 rounded"></div>
    <div className="h-32 w-full bg-slate-800/50 rounded-xl"></div>
  </div>
);

const GaugeSkeleton = () => (
  <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl h-60 p-5 animate-pulse flex flex-col items-center justify-center">
    <div className="w-40 h-40 rounded-full border-8 border-slate-800"></div>
  </div>
);

// Lazy-Loaded heavy visual leaf components (Zero bundle size overhead on main RSC payload)
export const DynamicProjectedRevenueChart = dynamic(
  () =>
    import('@/components/dashboard/left-column/ProjectedRevenueChart').then(
      (mod) => mod.ProjectedRevenueChart
    ),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const DynamicUnpaidAmountGauge = dynamic(
  () =>
    import('@/components/dashboard/left-column/UnpaidAmountGauge').then(
      (mod) => mod.UnpaidAmountGauge
    ),
  { ssr: false, loading: () => <GaugeSkeleton /> }
);

export const DynamicTotalInvoiceDataRing = dynamic(
  () =>
    import('@/components/dashboard/center-column/TotalInvoiceDataRing').then(
      (mod) => mod.TotalInvoiceDataRing
    ),
  { ssr: false, loading: () => <GaugeSkeleton /> }
);

export const DynamicCashFlowProfitCharts = dynamic(
  () =>
    import('@/components/dashboard/center-column/CashFlowProfitCharts').then(
      (mod) => mod.CashFlowProfitCharts
    ),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const DynamicCollectionHealthCompass = dynamic(
  () =>
    import('@/components/dashboard/right-column/CollectionHealthCompass').then(
      (mod) => mod.CollectionHealthCompass
    ),
  { ssr: false, loading: () => <GaugeSkeleton /> }
);

export const DynamicExpenseCategoryChart = dynamic(
  () =>
    import('@/components/dashboard/right-column/ExpenseCategoryChart').then(
      (mod) => mod.ExpenseCategoryChart
    ),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
