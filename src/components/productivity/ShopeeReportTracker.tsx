'use client';

import React, { useTransition } from 'react';
import { toggleShopeeReportUpload } from '@/app/actions/productivity';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface ReportRow {
  report_date: string;
  is_uploaded: boolean;
  uploaded_at?: string;
}

export function ShopeeReportTracker({ reports }: { reports: ReportRow[] }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (dateStr: string, currentStatus: boolean) => {
    startTransition(async () => {
      await toggleShopeeReportUpload(dateStr, !currentStatus);
    });
  };

  return (
    <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-lg relative">
      {isPending && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
        </div>
      )}
      <div className="p-4 border-b border-[#d4af37]/10 bg-zinc-900/40">
        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Shopee Daily Reports</h2>
        <p className="text-xs text-zinc-400 mt-1">Track if daily Shopee reports have been uploaded to dashboard.profesoronline.id</p>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {reports.map(report => {
          const dateObj = new Date(report.report_date);
          const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          
          return (
            <div key={report.report_date} className="p-3 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
              <div>
                <div className="font-semibold text-sm text-zinc-200">{formattedDate}</div>
                {report.uploaded_at && (
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    Uploaded: {new Date(report.uploaded_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
              <button 
                onClick={() => handleToggle(report.report_date, report.is_uploaded)}
                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                  report.is_uploaded 
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                {report.is_uploaded ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">
                  {report.is_uploaded ? 'Done' : 'Mark Done'}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
