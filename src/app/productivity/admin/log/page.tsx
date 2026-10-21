import React from 'react';
import { ScrollText } from 'lucide-react';
import { getDashboardUploadLog, getRelineUploadLog } from '@/lib/integrations/dashboard-uploads';
import { normalizeLogs } from '@/lib/integrations/upload-performance';
import { AdminLogDetail } from '@/components/productivity/AdminLogDetail';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';

export const dynamic = 'force-dynamic';

const DAYS = 30;

/** Admin > Log Detail: every upload of Profesor Dashboard and Reline (Reline Project, Alpha Project, Light Solution Project). */
export default async function AdminLogPage() {
  const [prof, reline] = await Promise.all([getDashboardUploadLog(DAYS), getRelineUploadLog(DAYS)]);
  const { rows, errors } = normalizeLogs(prof, reline);
  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/admin" active="log" />
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><ScrollText className="w-8 h-8" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Log Detail</h1>
          <p className="text-sm text-zinc-400 mt-1">Live from dashboard.profesoronline.id and reline.profesoronline.id</p>
        </div>
      </div>
      <AdminLogDetail rows={rows} errors={errors} days={DAYS} />
    </div>
  );
}
