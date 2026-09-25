import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { AdvertiserDashboard } from '@/components/productivity/AdvertiserDashboard';
import { Megaphone } from 'lucide-react';

export default async function AdvertiserDivisionPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, activeWorkspaceName, role } = await getAuthenticatedWorkspaceContext(supabase);

  let { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', activeWorkspaceId)
    .order('name');

  const { data: userData } = await supabase.auth.getUser();

  if (role !== 'superadmin' && role !== 'founder' && clients) {
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('client_id')
      .eq('workspace_id', activeWorkspaceId)
      .eq('user_id', userData.user?.id);

    if (assignments) {
      const assignedIds = new Set(assignments.map(a => a.client_id));
      clients = clients.filter(c => assignedIds.has(c.id));
    } else {
      // If table doesn't exist or error, assume no clients assigned or fallback
      clients = [];
    }
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
          <Megaphone className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Advertiser Division</h1>
          <p className="text-sm text-zinc-400 mt-1">Workspace: {activeWorkspaceName}</p>
        </div>
      </div>

      <div className="text-sm text-zinc-400 max-w-3xl mb-8">
        Manage Shopee/Tiktok Ads performance per client. Select a client, choose the ad group category, and paste your data directly from your Spreadsheet to analyze and provide recommendations.
      </div>

      <AdvertiserDashboard clients={clients || []} />
    </div>
  );
}
