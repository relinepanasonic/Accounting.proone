import React from 'react';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { getShopeeReports } from '@/app/actions/productivity';
import { ShopeeReportTracker } from '@/components/productivity/ShopeeReportTracker';
import { AdminPerformance } from '@/components/productivity/AdminPerformance';
import { getDashboardUploadLog, getRelineUploadLog } from '@/lib/integrations/dashboard-uploads';
import { buildPerformance, normalizeLogs } from '@/lib/integrations/upload-performance';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { Shield, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

/** Admin > Performance: the to-do of the admins. Every assigned store against what was uploaded, week by week. */
export default async function AdminPerformancePage() {
  const { activeWorkspaceName } = await getAuthenticatedWorkspaceContext();
  const [prof, reline, reports] = await Promise.all([getDashboardUploadLog(35), getRelineUploadLog(35), getShopeeReports(7)]);
  const { rows, assigned, errors } = normalizeLogs(prof, reline);
  const performance = buildPerformance(rows, assigned);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/admin" active="performance" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><Shield className="w-8 h-8" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Admin Performance</h1>
            <p className="text-sm text-zinc-400 mt-1">Company: {activeWorkspaceName} · what the admins still have to upload</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="https://dashboard.profesoronline.id/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-4 py-2 text-xs font-bold text-blue-200 hover:bg-blue-600/20">Profesor Dashboard <ExternalLink className="w-3.5 h-3.5" /></a>
          <a href="https://reline.profesoronline.id/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-4 py-2 text-xs font-bold text-blue-200 hover:bg-blue-600/20">Reline <ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </div>

      <AdminPerformance rows={performance} errors={errors} />

      <div className="max-w-xl">
        <ShopeeReportTracker reports={reports} />
      </div>
    </div>
  );
}
