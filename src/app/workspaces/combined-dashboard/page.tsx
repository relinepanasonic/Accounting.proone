import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { LayoutDashboard, ArrowLeft } from 'lucide-react';
import { getDashboardTelemetry } from '@/lib/data/dashboard';

import { DashboardTopNumbers } from '@/components/dashboard/center-column/DashboardTopNumbers';
import { DashboardBottomNumbers } from '@/components/dashboard/center-column/DashboardBottomNumbers';
import { DashboardChartsRow3 } from '@/components/dashboard/center-column/DashboardChartsRow3';
import { DashboardChartsRow4 } from '@/components/dashboard/center-column/DashboardChartsRow4';
import { DashboardTablesRow5 } from '@/components/dashboard/center-column/DashboardTablesRow5';

export const dynamic = 'force-dynamic';

const ColumnSkeleton = () => (
  <div className="flex flex-col gap-6 animate-pulse">
    <div className="gold-glass-panel rounded-2xl h-32"></div>
    <div className="gold-glass-panel rounded-2xl h-32"></div>
    <div className="gold-glass-panel rounded-2xl h-64"></div>
  </div>
);

export default async function CombinedDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; month?: string }>;
}) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.userId) redirect('/login');

  const { w, month } = await searchParams;
  if (!w) redirect('/workspaces/combined-setup');

  const requestedIds = w.split(',').filter(Boolean);
  
  // Security verification: ensure user is actually allowed in these workspaces
  const allowedIds = ctx.availableWorkspaces.map(ws => ws.id);
  const validIds = requestedIds.filter(id => allowedIds.includes(id));

  if (validIds.length === 0) {
    redirect('/workspaces/combined-setup');
  }

  // Fetch names of the combined workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', validIds);

  const workspaceNames = (workspaces || []).map(ws => ws.name).join(' + ');

  const monthFilter = month ? parseInt(month, 10) : null;
  const telemetry = await getDashboardTelemetry({ monthFilter, workspaceIds: validIds });

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-100 flex flex-col">
      {/* Custom Header for Combined Dashboard */}
      <div className="w-full bg-[#0e0f14]/90 backdrop-blur-md border-b border-[#d4af37]/20 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <a href="/workspaces/combined-setup" className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </a>
          <div>
            <h1 className="font-serif text-xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-[#d4af37]" />
              Global Aggregated Dashboard
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-medium bg-[#d4af37]/10 text-[#f5d77f] border border-[#d4af37]/30 px-2 py-0.5 rounded-full">
                Viewing: {workspaceNames}
              </span>
            </div>
          </div>
        </div>
        <a href="/workspaces" className="text-sm font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-colors">
          Exit to Home
        </a>
      </div>

      <div className="flex-1 p-4 lg:p-8 max-w-[1600px] mx-auto w-full">
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
    </div>
  );
}
