import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { LayoutDashboard, ArrowLeft, TrendingUp, DollarSign, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CombinedDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.userId) redirect('/login');

  const { w } = await searchParams;
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

      <div className="flex-1 p-4 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
        
        {/* Placeholder Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="gold-glass-panel rounded-2xl p-6 border border-[#d4af37]/20">
            <div className="flex items-center gap-4 text-[#d4af37] mb-4">
              <div className="p-3 bg-[#d4af37]/10 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider">Total Combined Revenue</h3>
            </div>
            <p className="text-3xl font-serif font-bold text-white">Rp 0</p>
            <p className="text-xs text-zinc-500 mt-2">Aggregated across {validIds.length} companies</p>
          </div>

          <div className="gold-glass-panel rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-4 text-emerald-500 mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider">Net Margin</h3>
            </div>
            <p className="text-3xl font-serif font-bold text-white">Rp 0</p>
            <p className="text-xs text-zinc-500 mt-2">Aggregated across {validIds.length} companies</p>
          </div>

          <div className="gold-glass-panel rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-4 text-blue-500 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider">Combined Expenses</h3>
            </div>
            <p className="text-3xl font-serif font-bold text-white">Rp 0</p>
            <p className="text-xs text-zinc-500 mt-2">Aggregated across {validIds.length} companies</p>
          </div>
        </div>

        <div className="gold-glass-panel rounded-2xl p-8 border border-zinc-800 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Aggregated Data Engine Initialized</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            This is the foundation for your combined dashboard. We have securely loaded your workspace context for <strong>{workspaceNames}</strong>.
            From here, we can begin aggregating the specific charts and ledgers you need for high-level company analysis.
          </p>
        </div>

      </div>
    </div>
  );
}
