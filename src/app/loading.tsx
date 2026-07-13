import React from 'react';

export default function LoadingDashboardHUD() {
  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 p-6 flex flex-col justify-between">
      {/* Shell Skeleton Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800/80 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800"></div>
          <div className="space-y-1">
            <div className="w-48 h-4 bg-slate-800 rounded"></div>
            <div className="w-32 h-3 bg-slate-800/60 rounded"></div>
          </div>
        </div>
        <div className="w-28 h-6 bg-slate-800 rounded-full"></div>
      </div>

      {/* 3-Column Skeleton Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-56"></div>
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-60"></div>
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-48"></div>
        </div>
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-60"></div>
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-72"></div>
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-48"></div>
        </div>
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-48"></div>
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-60"></div>
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl h-44"></div>
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between animate-pulse">
        <div className="flex gap-4">
          <div className="w-32 h-10 bg-slate-800 rounded-full"></div>
          <div className="w-36 h-10 bg-slate-800 rounded-full"></div>
        </div>
        <div className="flex gap-3">
          <div className="w-20 h-10 bg-slate-800 rounded-lg"></div>
          <div className="w-20 h-10 bg-slate-800 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}
